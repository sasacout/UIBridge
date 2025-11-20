# UIBridge Architecture

## 1. 목적
UIBridge는 LVGL C 코드, React(JSX) 코드, Sketch 디자인을 단일 중간 표현(UI IR)으로 통합하고 양방향 변환 및 프리뷰를 제공하는 확장 가능한 파이프라인을 목표로 한다.

## 2. 상위 흐름 개요
```
[LVGL Code] -> LVGL Parser ----\
                                 \
[React Code] -> React Parser -----> Normalizer -> UI IR <---- Sketch Parser <- [Sketch File]
                                     |   ^
                                     |   |
                                     v   |
                              Mapping Engine (Rules)
                                     |
                                     v
               +----------------------+------------------+
               |                                         |
         React Generator                         LVGL Generator
               |                                         |
               +----------------------+------------------+
                                      |
                                      v
                              Export / Preview Service
```

## 3. 계층 (Layers)
### 3.1 Ingress Layer
- 입력 수집: 프로젝트 루트, 단일 파일, 업로드(스케치)
- Job Orchestrator: 변환/파싱 작업 큐, 상태(대기/진행/완료/에러)
- Asset Scanner: 이미지/폰트/CSV 경로 인식

### 3.2 Parsing & Normalization
- LVGL Parser: C AST(Tree-sitter/ANTLR) → Raw Widget Nodes (함수 호출/속성)
- React Parser: JSX AST → Component Nodes (props, children, events)
- Sketch Parser: 페이지/아트보드/레이어 → Design Nodes
- Normalizer: 세 출력물을 공통 스키마(UI IR)로 정규화 (type, layout, style, assets, events)

### 3.3 UI IR Core
- Store: 메모리 + 디스크 캐시(.cache/ui-ir/<hash>.json)
- Versioning: hash(파일 내용 + config + mapping version)
- Validation: 누락 필수 필드 / 스타일 충돌 정리
- Enhancement: Sketch 토큰 → Tailwind / LVGL Style 보정, 레이아웃 추론(Flex/Grid)

### 3.4 Mapping & Transformation
- Mapping Engine: 위젯/스타일/이벤트 규칙 적용 (선언형 룰 테이블)
- Style Mapper: Tailwind ↔ LVGL style API ↔ Sketch tokens
- Asset Resolver: 상대 경로 재작성(import 경로, LVGL 리소스)
- Event Placeholder: 추론 불가 이벤트 기본 핸들러 삽입

### 3.5 Code Generators
- React Generator: 컴포넌트 트리, import, Tailwind class, props, memoization(선택)
- LVGL Generator: 객체 생성 순서, 스타일/레이아웃 함수 호출, 이벤트 콜백 stub
- Export Packager: 단일/배치/zip + metadata.json

### 3.6 Reverse Flow
- React → IR → LVGL
- LVGL → IR → React
- 동일 Mapping Rules 재사용 (양방향 일관성)

### 3.7 Runtime & Preview
- Preview Service: iframe 기반 React 렌더 + (선택) WASM LVGL 시뮬레이터
- Storybook-like Index: 스크린 목록 + 상태/로그 패널
- Download Service: per-screen artifacts (React/LVGL/Assets/All)

### 3.8 Support Services
- Cache Layer: IR, 생성된 코드, zip 결과 저장
- Logging & Metrics: 위젯 수, 변환 시간, 실패 유형, 캐시 히트율
- Plugin System: 새 위젯/스타일/이벤트 매핑 추가 (hot reload 가능)
- ADR & Schema Registry: 변경 내역 추적

## 4. 데이터 흐름 상세
1. 입력 감지 (파일 변경 이벤트 / 업로드)
2. 변경 파일 diff → 대상 파서만 재실행 (Incremental)
3. AST 생성 → Raw Nodes 추출
4. Normalizer가 공통 필드 매핑 및 누락 채움(defaults)
5. IR 해시 계산 → 캐시 확인 (존재 시 Generator 단계로 skip)
6. Mapping Engine 규칙 적용 → 매핑된 IR 확장
7. Code Generator 실행 → 출력 코드 / 에셋 목록
8. Preview 업데이트 / Export 요청 시 패키징

## 5. UI IR 스키마 (요약)
```json
{
  "version": "1.0",
  "screenId": "screen_main",
  "widgets": [
    {
      "id": "btn_login",
      "type": "Button",
      "children": ["lbl_login"],
      "layout": { "x": 40, "y": 120, "w": 160, "h": 48, "display": "flex" },
      "style": { "bgColor": "#1E90FF", "radius": 8, "font": "Pretendard-SemiBold", "color": "#FFFFFF" },
      "events": [ { "name": "onClick", "source": "lv_event_clicked" } ],
      "assets": [],
      "text": "Login"
    }
  ],
  "assets": { "images": ["/ui/images/logo.png"], "fonts": ["/ui/fonts/Pretendard.ttf"] },
  "meta": { "generatedAt": "2025-11-17T10:00:00Z" }
}
```

## 6. 매핑 룰 포맷 예시
```json
{
  "widgetMap": {
    "lv_btn": { "react": "Button", "props": {"variant": "primary"} },
    "lv_label": { "react": "Label" }
  },
  "styleMap": {
    "bgColor": { "tailwind": "bg-blue-500", "lvgl": "lv_style_set_bg_color" },
    "radius": { "tailwind": "rounded-md", "lvgl": "lv_style_set_radius" }
  },
  "eventMap": {
    "lv_event_clicked": { "react": "onClick" }
  }
}
```

## 7. 캐싱 전략
- 키: SHA256(정렬된 IR JSON + mapping version)
- 저장: 메모리(LRU 256개) + 디스크(.cache/ir/<hash>.json)
- Invalidation: 소스 파일 변경 해시 다름 / Mapping 룰 버전 증가 / 환경 설정(conf.json) 변경
- 2차 캐시: 생성된 코드(.cache/gen/react/<screenId>.jsx, .cache/gen/lvgl/<screenId>.c)

## 8. 에러 & 로깅 패턴
| 영역 | 코드 | 설명 |
|------|------|------|
| Parser | P001 | 토큰화 실패 |
| Parser | P002 | 지원되지 않는 문법 |
| Normalizer | N001 | 필수 필드 누락 |
| Mapping | M001 | 위젯 타입 매핑 실패 |
| Generator | G001 | 코드 템플릿 렌더 오류 |
| Export | E001 | 압축 실패 |

로그 필드: timestamp, level, jobId, stage, code, message, duration(ms)

## 9. API 요약 (선택적)
- GET /screens
- GET /screens/:id/preview
- GET /export/react/:screenId
- GET /export/lvgl/:screenId
- GET /export/assets/:screenId
- GET /export/all/:screenId
- POST /import/sketch
- GET /import/sketch/:jobId/status

## 10. 확장 포인트
- 새 플랫폼 추가 (예: Flutter): Parser + Generator + styleMap 섹션 추가
- 디자인 토큰: Sketch → tokens.json → Tailwind config 자동 재생성
- Diff Export: 이전 IR 대비 변경 JSON + git patch

## 11. 보안 고려
- 파일 경로 정규화 (절대/상대 경로 탈출 차단)
- 업로드 Sketch 파일 MIME 검증
- 임시 디렉터리 자동 삭제 (TTL)
- 로그 내 민감 데이터(텍스트 레이어 내용 중 개인정보 등) 마스킹 옵션

## 12. 성능 최적화 아이디어
- Incremental AST (변경된 부분만 재파싱)
- 스타일 토큰 캐싱 (Hash → Tailwind class 조합)
- 병렬 파싱 (LVGL / React / Sketch 분리 실행)
- Web Worker / Child Process 격리 (대형 Sketch 처리)

## 13. 폴더 구조 제안
```
UIBridge/
  src/
    core/ui-ir/
    core/mapping/
    parsers/{lvgl,react,sketch}/
    generators/{react,lvgl}/
    services/{preview,export,cache,logging}/
    plugins/
  docs/
    architecture/
      overview.md
      parser.md
      mapping.md
      ui-ir-schema.md
  ARCHITECTURE.md
  README.me
```

## 14. 향후 ADR 후보
- ADR-001: UI IR 스키마 채택 사유
- ADR-002: Tree-sitter vs ANTLR 선택 근거
- ADR-003: 캐싱 레이어(메모리+디스크) 전략

## 15. 간단 요약
"UIBridge는 다중 소스(LVGL/React/Sketch)를 통합 UI IR으로 변환하고 선언형 매핑을 통해 양방향 코드 생성과 프리뷰, 다운로드를 지원하는 계층형 아키텍처를 채택한다."
