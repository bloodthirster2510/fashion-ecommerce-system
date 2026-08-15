import {
  getTryOnJobErrorMessage,
  getTryOnVideoErrorMessage,
} from '../virtualTryOnErrorMessages';

describe('virtual try-on customer error messages', () => {
  it('translates known provider failures into natural Vietnamese', () => {
    expect(getTryOnJobErrorMessage('COMFY_TIMEOUT')).toContain('lâu hơn dự kiến');
    expect(getTryOnVideoErrorMessage('VIDEO_PROVIDER_RATE_LIMITED')).toContain('đang bận');
  });

  it('never exposes an unknown technical code', () => {
    const imageMessage = getTryOnJobErrorMessage('INTERNAL_NODE_42_FAILED');
    const videoMessage = getTryOnVideoErrorMessage('COMFY_WORKFLOW_PARSE_ERROR');

    expect(imageMessage).not.toContain('INTERNAL_NODE_42_FAILED');
    expect(videoMessage).not.toContain('COMFY_WORKFLOW_PARSE_ERROR');
    expect(imageMessage).toContain('Chưa thể tạo ảnh');
    expect(videoMessage).toContain('bộ ảnh vẫn được giữ lại');
  });

  it('uses a safe fallback when the backend sends no code', () => {
    expect(getTryOnJobErrorMessage(null)).toContain('thử lại');
    expect(getTryOnVideoErrorMessage(undefined)).toContain('bộ ảnh');
  });
});
