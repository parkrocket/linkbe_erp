import { defineConfig } from 'vitest/config';
import path from 'node:path';

// 순수 로직(lib) 단위 테스트 전용
export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    test: { include: ['src/**/*.test.ts'] },
});
