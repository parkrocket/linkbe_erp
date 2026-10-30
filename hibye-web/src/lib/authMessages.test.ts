import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { adminErrorMessage, loginErrorMessage } from './authMessages';

describe('loginErrorMessage', () => {
    it('계정 상태별 안내', () => {
        expect(loginErrorMessage('Pending approval')).toBe('가입 승인을 기다리고 있어요. 승인 후 로그인할 수 있어요.');
        expect(loginErrorMessage('Registration rejected')).toBe('가입이 승인되지 않았어요. 관리자에게 문의해 주세요.');
        expect(loginErrorMessage('Account inactive')).toBe('비활성화된 계정이에요. 관리자에게 문의해 주세요.');
    });

    it('그 외(계정 없음·비밀번호 틀림)는 구분 없이 같은 문구 — 계정 존재 여부를 드러내지 않음', () => {
        expect(loginErrorMessage('User not found')).toBe('이메일 또는 비밀번호를 확인해 주세요.');
        expect(loginErrorMessage('Invalid credentials')).toBe('이메일 또는 비밀번호를 확인해 주세요.');
        expect(loginErrorMessage(undefined)).toBe('이메일 또는 비밀번호를 확인해 주세요.');
    });
});

describe('adminErrorMessage', () => {
    it('관리 작업 사유별 안내', () => {
        expect(adminErrorMessage(new ApiError(409, 'Cannot change yourself'))).toBe('자기 자신은 변경할 수 없어요.');
        expect(adminErrorMessage(new ApiError(409, 'Last admin'))).toBe('관리자는 최소 1명 있어야 해요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid transition'))).toBe('지금 상태에서는 할 수 없는 작업이에요.');
        expect(adminErrorMessage(new ApiError(403, 'Admin only'))).toBe('관리자만 할 수 있어요.');
        expect(adminErrorMessage(new ApiError(404, 'User not found'))).toBe('대상 직원을 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.');
        expect(adminErrorMessage(new Error('x'))).toBe('처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    });

    it('인사 정보·조직 사유별 안내', () => {
        expect(adminErrorMessage(new ApiError(409, 'Duplicate name'))).toBe('이미 있는 이름이에요.');
        expect(adminErrorMessage(new ApiError(409, 'In use'))).toBe('소속 직원이 있어 삭제할 수 없어요. 이름 변경만 가능해요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid department'))).toBe('부서·직급 목록이 바뀌었어요. 새로고침 후 다시 선택해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid position'))).toBe('부서·직급 목록이 바뀌었어요. 새로고침 후 다시 선택해 주세요.');
        for (const reason of ['Invalid name', 'Invalid phone', 'Invalid doe', 'Invalid birth', 'Invalid gender', 'Invalid employment type']) {
            expect(adminErrorMessage(new ApiError(400, reason))).toBe('입력값을 확인해 주세요.');
        }
    });

    it('근태 대신 취소 사유별 안내', () => {
        expect(adminErrorMessage(new ApiError(404, 'Leave not found'))).toBe('이미 취소됐거나 찾을 수 없는 근태예요. 새로고침해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'Past date not allowed'))).toBe('지난 근태는 취소할 수 없어요. 연차·휴가 탭에서 일수를 조정해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid range'))).toBe('조회 기간을 확인해 주세요.');
    });

    it('연차·휴가 조정 사유별 안내', () => {
        expect(adminErrorMessage(new ApiError(409, 'Balance changed'))).toBe('그 사이 잔여가 바뀌었어요. 다시 불러온 뒤 입력해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid reason'))).toBe('사유를 1~200자로 입력해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid balance'))).toBe('입력값을 확인해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'Invalid changes'))).toBe('입력값을 확인해 주세요.');
        expect(adminErrorMessage(new ApiError(400, 'No changes'))).toBe('바뀐 값이 없어요.');
    });
});
