# Win Trace Pipeline Plan

## 목적

브라우저 확장 프로그램이 DCSS 승리 게임 데이터를 로컬에서 활용할 수 있도록, 서버별 `logfile/xlog`, `milestones`, `morgue`를 수집해 승리 게임 단위의 정적 `WinTrace` 번들을 만든다.

초기 목표는 다음과 같다.

- 최신 2개 의미 버전만 다룬다.
- 승리 게임만 대상으로 한다.
- 확장 프로그램은 집계본이 아니라 per-game `parsed skill trace` 전체 번들을 사용한다.
- 업데이트는 동적 API 서버가 아니라 정적 snapshot 교체 방식으로 시작한다.

## 현재 결론

### 1. 데이터 소스

- `logfile/xlog`
  - 전체 게임 인덱스 역할
  - 승리 게임만 빠르게 선별 가능
  - `start`, `end`, `v`, `race`, `cls`, `char`, `god`, `piety` 등 핵심 메타 확보 가능
- `milestones`
  - 종교 변경 이력 복원용
  - `god.worship`, `god.renounce`, `god.ecumenical` 등 이벤트와 `xl`, `time`을 함께 얻을 수 있음
- `morgue`
  - `Skill XL:` 표를 읽어 스킬 성장 이력 복원

### 2. 수집 순서

권장 파이프라인:

1. `logfile/xlog` 수집
2. 승리 게임 인덱스 생성
3. 같은 게임의 `milestones` 추출
4. 같은 게임의 `morgue` fetch
5. `WinTrace` record 생성
6. 버전별 정적 번들 생성

핵심 이유:

- `logfile`가 전체 게임의 인덱스다.
- `morgue`부터 모으면 어떤 게임을 가져와야 하는지 알기 어렵다.
- `milestones`는 `god` 변화 복원에 적합하고, `morgue`는 스킬 성장 복원에 적합하다.

### 3. trunk / git 처리

`sourceBucket=git/trunk`는 fetch 경로를 찾는 데만 쓰고, 의미 버전은 별도 필드로 저장한다.

각 게임에 저장할 버전 필드:

- `sourceBucket`
- `fullVersion`
- `versionMinor`

예시:

- `sourceBucket`: `git`
- `fullVersion`: `0.35-a0`
- `versionMinor`: `0.35`

정책:

- URL/원본 파일 추적은 `sourceBucket` 기준
- 최신 2개 버전 필터링은 `versionMinor` 기준
- 필요하면 prerelease/stable 구분은 `fullVersion` 기준

### 4. 최종 grouping 관점

`finalGod`만으로 grouping 하는 것은 부정확하다.

이유:

- 초중반 생존을 위한 신과 후반 마무리용 신이 다를 수 있다.
- 신을 버리거나 갈아타는 빌드가 존재한다.

따라서 최종 산출물에는 `finalGod`만 저장하지 말고 `religionTrace`를 함께 저장해야 한다.

권장 religion 관련 필드:

- `finalGod`
- `religionTrace`
- 필요 시 `openingGod`, `godPathKey`, `switchCount`를 파생 가능하게 설계

### 5. Demigod 처리

- `race=Demigod`로 식별 가능
- `finalGod=null`
- `religionTrace=[]`
- 별도 `canWorship=false` 파생 가능

## 최종 canonical record 제안

```json
{
  "gameId": "hash(server,name,start)",
  "server": "CNC",
  "sourceBucket": "git",
  "fullVersion": "0.35-a0",
  "versionMinor": "0.35",
  "player": "foo",
  "race": "Mi",
  "class": "Fi",
  "char": "MiFi",
  "startAt": "2026-03-30T12:34:56Z",
  "endAt": "2026-03-31T02:22:10Z",
  "finalGod": "Gozag",
  "religionTrace": [[2, "Okawaru"], [18, null], [21, "Gozag"]],
  "skills": {
    "0": [[3, 4], [6, 5], [8, 7]],
    "1": [[1, 5], [2, 6], [5, 8]]
  }
}
```

설명:

- `religionTrace`: `[[xl, godNameOrNull]]`
- `skills`: `skillId -> [[xl, level]]`
- 둘 다 sparse trace

## skill trace 가공 방향

`morgue`의 `Skill XL:` 표를 읽어 dense array를 만든 뒤 sparse change trace로 바꾼다.

예시:

```json
{
  "Fighting": [0, 0, 4, 4, 4, 5, 5, 7]
}
```

를

```json
{
  "Fighting": [[3, 4], [6, 5], [8, 7]]
}
```

로 바꾼다.

구현 주의점:

- multi-word skill 이름을 정확히 파싱해야 함
- 헤더에서 XL 열 위치를 robust 하게 읽어야 함
- 빈 칸은 이전 값을 carry-forward 해야 함
- trained 적 없는 스킬은 생략 가능

## 정적 배포 방식

초기에는 patch 없이 snapshot 교체 방식으로 시작한다.

산출물:

- `manifest.json`
- `report.json`
- `wins-0.34-rN.json.br`
- `wins-0.35-rN.json.br`

예시:

```json
{
  "revision": 12,
  "versions": {
    "0.34": "wins-0.34-r12.json.br",
    "0.35": "wins-0.35-r12.json.br"
  }
}
```

## 요청 throttle 기본값

외부 Crawl 서버에 부담을 주지 않기 위해, build 단계의 원격 요청은 per-server throttle을 탄다.

기본 정책:

- 서버별 동시 요청 수: `1`
- 서버별 요청 간격 cap: `1 req / 1000ms`
- `logfile`, `milestones`, `morgue` 요청 모두 같은 throttle 사용

CLI에서 조절할 값:

- `--request-concurrency=<N>`
- `--request-interval-ms=<ms>`
- `--request-interval-cap=<N>`
- 기본 source filter는 `0.30+`와 `git`
- `--min-source-version=0.31`
- `--source-buckets=0.32,git`
- `--max-wins-per-source=25` 로 소스별 최근 승리 게임 몇 판만 spot check 가능
- `--max-total-wins=200` 으로 모든 선택된 source를 합쳐 최근 승리 게임 N판만 대상으로 morgue를 가져오게 할 수 있음
- 기본 tail fetch는 `logfile 2MiB+`, `milestones 8MiB+`
- `--logfile-tail-bytes=<bytes>`
- `--milestones-tail-bytes=<bytes>`
- `--servers=CNC,CDI` 같은 서버 필터로 표본 서버만 안전하게 테스트 가능

## 다음 작업 체크리스트

### Phase 1. 수집 설정 확정

- [x] 서버 설정 스키마 정의
- [x] 각 서버별 `logfilePath`, `milestonesPath`, `morgueBaseUrl`, `sourceBucket`, 예외 prefix 정리
- [ ] `milestones`를 공개하지 않는 서버가 있는지 확인하고 fallback 정책 정하기

### Phase 2. win index 만들기

- [x] `logfile/xlog` downloader 초안 작성
- [x] 승리 게임만 추출하는 parser 작성
- [x] `gameId = hash(server,name,start)` 규칙 확정
- [x] `sourceBucket`, `fullVersion`, `versionMinor` 저장 규칙 확정

### Phase 3. religion trace 만들기

- [x] `milestones` downloader 초안 작성
- [x] god 관련 milestone type 목록 정리
- [x] `religionTrace` 생성 로직 구현
- [ ] `finalGod`와 `religionTrace`가 충돌할 때 검증 규칙 정하기

### Phase 4. morgue -> skill trace

- [x] robust 한 `Skill XL` 표 parser 설계
- [x] dense skill array 생성
- [x] sparse change trace 변환
- [x] skill name -> skill id 매핑 정의

### Phase 5. WinTrace 번들 생성

- [x] `WinTrace` JSON 스키마 확정
- [x] 버전별 `.json.br` 출력기 작성
- [x] `manifest.json` 출력기 작성
- [x] 최신 2개 `versionMinor`만 남기는 정책 구현

### Phase 6. 검증

- [ ] 표본 몇 개 서버로 end-to-end 수집 테스트
- [ ] `morgue` fetch 실패율 측정
- [ ] `religionTrace`가 실제 플레이 흐름과 맞는지 spot check
- [ ] 번들 최종 용량 측정

## 바로 다음에 하면 좋을 작업

지금 상태에선 ingest skeleton, `morgue` downloader, `WinTrace` bundle writer까지 구현되어 있다.

바로 다음엔 검증과 정책 보강으로 넘어가는 편이 좋다.

1. 표본 서버 몇 개를 골라 `yarn workspace @dcss-stats/api wintrace:build --revision=<N>`로 end-to-end spot check
2. `milestonesPath`가 없거나 404인 서버 목록을 실제로 확인하고 fallback 정책 문서화
3. `finalGod`와 `religionTrace` 충돌 케이스를 몇 판 추출해 경고 규칙 보강
4. `morgue` fetch 실패 케이스를 보고 URL fallback이 필요한 서버를 정리

## 확장프로그램 소비 helper

번들 소비 쪽에서는 다음 helper들을 기본 제공하는 방향이 좋다.

- `getGodAtXl(religionTrace, xl)`
- `getSkillLevelAtXl({ skills, skillId, xl })`
- `getSkillLevelsAtXl({ skills, xl })`
- `getSkillsTrainedAtXl({ skills, xl })`
- `wasSkillTrainedInWindow({ skills, skillId, fromXl, toXl })`
- `filterWinTraceRecords({ records, versionMinor, race, className, godAtXl, xl })`
- `buildSkillRecommendations({ records, xl, nextWindow, race, className, godAtXl })`

## 추천 inspection CLI

추천 집계를 빠르게 확인하기 위한 CLI를 함께 제공한다.

예시:

```bash
node .yarn/releases/yarn-4.13.0.cjs workspace @dcss-stats/api wintrace:recommend \
  --version=0.32 \
  --xl=10 \
  --race=Minotaur \
  --class=Fighter \
  --god-at-xl=Okawaru \
  --top=5
```

지원하는 주요 옵션:

- `--output-dir=<dir>`
- `--bundle=<path>`
- `--version=<0.32>`
- `--xl=<number>`
- `--next-window=<number>`
- `--race=<Race>`
- `--class=<Class>`
- `--final-god=<God|null>`
- `--god-at-xl=<God|null>`
- `--skill-ids=<id1,id2>`
- `--top=<number>`
- `--min-sample=<number>`
- `--no-fallback`
- `--json`

기본 추천 동작:

- `race + class + xl` 기준으로 먼저 추천을 시도
- 표본이 `--min-sample`보다 적으면 `class`, `race`, `all` 순서로 완화
- JSON 출력에는 `matchedBy`와 `sampleThreshold`가 함께 들어감
- `buildSkillRecommendations({ records, xl, nextWindow, race, className, godAtXl })`

추천 집계 기본 출력:

- `sampleSize`
- `trainedAtXlRate`
- `trainedNextWindowRate`
- `nonZeroRate`
- `levelSummary.min/max/mean/p25/median/p75`
