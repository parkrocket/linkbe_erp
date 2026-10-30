// 화면 데이터 조회 상태 (useApiData)
export type ApiState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

// 다시 불러오기 직전 상태 — silent(저장 후 새로고침)면 보이던 데이터를 유지해
// 목록이 로딩 화면으로 바뀌며 팝업·안내 문구가 사라지는 것을 막음
export function stateBeforeRefetch<T>(prev: ApiState<T>, silent: boolean): ApiState<T> {
    return silent && prev.status === 'ok' ? prev : { status: 'loading' };
}
