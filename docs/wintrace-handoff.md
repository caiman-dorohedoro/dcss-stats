# WinTrace Handoff

## 목적

현재 작업은 DCSS 승리 게임 데이터를 서버별 `logfile/xlog`, `milestones`, `morgue`에서 수집해, 브라우저 확장 프로그램이 바로 소비할 수 있는 정적 `WinTrace` 번들로 만드는 것이다.

핵심 목표:

- 승리 게임만 수집한다.
- 최신 의미 버전 2개만 번들링한다.
- 집계본이 아니라 per-game `religionTrace` + `skill trace`를 남긴다.
- 초기 배포는 API가 아니라 정적 snapshot 교체 방식으로 간다.

## 이번에 들어간 변경

- `apps/api/src/wintrace`에 새 파이프라인 구현 추가
- `apps/api/package.json`에 아래 CLI 스크립트 추가
  - `wintrace:build`
  - `wintrace:recommend`
- `docs/wintrace-pipeline-plan.md`에 설계, 체크리스트, 추천 CLI 사용법 문서화
- 생성 캐시/산출물 경로를 `.gitignore`에 추가

구현된 큰 덩어리는 다음과 같다.

- 서버 설정 선택 및 source bucket 필터링
- `logfile/xlog` 기반 승리 게임 인덱싱
- `milestones` 기반 `religionTrace` 구성
- `morgue` 기반 `Skill XL` 파싱 및 sparse skill trace 변환
- 버전별 `wins-<version>-rN.json.br` 번들 생성
- `manifest.json`, `report.json` 생성
- 번들 inspection 용 추천 CLI
- 주요 모듈 단위 테스트

## 현재 상태

소스는 구현이 거의 끝난 상태이고, 다음 단계는 검증과 정책 보강이다.

- 구현 디렉터리: `apps/api/src/wintrace`
- 테스트 파일 수: 16개
- 현재 문서상 상태:
  - ingest skeleton 완료
  - morgue downloader 완료
  - bundle writer 완료
  - 추천 inspection CLI 완료
  - 남은 일은 검증, fallback 정책, warning 규칙 보강

## 최근 빌드 결과 메모

로컬 산출물 기준 마지막 확인된 결과:

- generatedAt: `2026-04-01T13:59:22.119Z`
- revision: `8`
- 번들 포함 버전: `0.34`
- records built: `155`

리포트 요약:

- source 3개 사용: `CNC`, `CDI`, `CXC`
- `winsFound=155`
- `recordsBuilt=155`
- `skippedCount=0`
- ingest warning:
  - `logfile-tail-too-small`: 1
  - `download-error`: 1
  - `milestones-download-failed`: 1
- religion warning:
  - `missing-religion-events`: 120

관찰 메모:

- `CXC`는 `milestonesFound=0`으로 찍혀서 milestones 다운로드 fallback 정책이 필요해 보인다.
- 종교 이벤트 누락 경고가 많아서 `finalGod`와 `religionTrace` 충돌/누락 규칙을 보강해야 한다.
- `apps/api/wintrace-cache`, `apps/api/wintrace-dist`는 재생성 가능한 산출물이므로 커밋하지 않고 ignore 한다.

## 확인한 테스트 상태

아래 명령으로 `wintrace` 범위 테스트를 확인했고 현재 모두 통과한다.

```bash
node .yarn/releases/yarn-4.13.0.cjs workspace @dcss-stats/api vitest run src/wintrace
```

- test files: `16 passed`
- tests: `71 passed`

## 하다가 멈춘 지점

문서 체크리스트 기준으로 아직 남아 있는 일:

1. 표본 서버 몇 개로 end-to-end spot check 다시 돌리기
2. `milestonesPath`가 없거나 404인 서버 목록 확인 후 fallback 정책 문서화
3. `finalGod`와 `religionTrace` 충돌 케이스 추출 후 warning 규칙 보강
4. `morgue` fetch 실패 케이스를 보고 서버별 URL fallback 필요 여부 확인
5. 최종 번들 용량 측정

## 재개할 때 바로 볼 파일

- `apps/api/src/wintrace/build.ts`
- `apps/api/src/wintrace/pipeline.ts`
- `apps/api/src/wintrace/bundles.ts`
- `apps/api/src/wintrace/morgues.ts`
- `apps/api/src/wintrace/recommendCli.ts`
- `docs/wintrace-pipeline-plan.md`

## 재개 명령어

빌드:

```bash
node .yarn/releases/yarn-4.13.0.cjs workspace @dcss-stats/api wintrace:build --revision=<N>
```

표본 서버만 spot check:

```bash
node .yarn/releases/yarn-4.13.0.cjs workspace @dcss-stats/api wintrace:build \
  --revision=<N> \
  --servers=CNC,CDI \
  --max-wins-per-source=25
```

추천 inspection:

```bash
node .yarn/releases/yarn-4.13.0.cjs workspace @dcss-stats/api wintrace:recommend \
  --version=0.34 \
  --xl=10 \
  --race=Minotaur \
  --class=Fighter \
  --god-at-xl=Okawaru \
  --top=5
```
