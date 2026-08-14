const imageMessages: Record<string, string> = {
  COMFY_TIMEOUT: 'Hệ thống đang xử lý lâu hơn dự kiến. Bạn thử lại sau ít phút nhé.',
  COMFY_RATE_LIMITED: 'Hệ thống đang có nhiều yêu cầu. Bạn thử lại sau ít phút nhé.',
  COMFY_NO_CREDITS: 'Dịch vụ phối đồ đang tạm gián đoạn. Vui lòng thử lại sau.',
  PROVIDER_SAFETY_BLOCKED: 'Bạn đổi ảnh người hoặc ảnh sản phẩm phù hợp hơn rồi tạo lại nhé.',
  COMFY_OUTPUT_MISSING: 'Chưa tạo được ảnh phù hợp từ lựa chọn này. Bạn hãy thử lại nhé.',
  PROVIDER_OUTPUT_MISSING: 'Chưa tạo được ảnh phù hợp từ lựa chọn này. Bạn hãy thử lại nhé.',
  VIRTUAL_TRY_ON_DISABLED: 'Tính năng phối đồ ảo đang tạm tắt.',
  JOB_CANCELED: 'Yêu cầu đã được hủy.',
};

const videoMessages: Record<string, string> = {
  VIDEO_PROVIDER_TIMEOUT: 'Video đang xử lý lâu hơn dự kiến. Bạn có thể thử tạo lại video.',
  VIDEO_PROVIDER_RATE_LIMITED: 'Hệ thống tạo video đang bận. Bạn thử lại sau ít phút nhé.',
  VIDEO_PROVIDER_NO_CREDITS: 'Dịch vụ tạo video đang tạm gián đoạn.',
  VIDEO_PROVIDER_SAFETY_BLOCKED: 'Không thể tạo video từ ảnh này do chính sách an toàn.',
  VIDEO_OUTPUT_MISSING: 'Chưa thể tạo video, nhưng bộ ảnh vẫn được giữ lại.',
};

export const getTryOnJobErrorMessage = (errorCode?: string | null) => (
  (errorCode && imageMessages[errorCode])
  || 'Chưa thể tạo ảnh phối đồ lúc này. Bạn thử lại sau ít phút nhé.'
);

export const getTryOnVideoErrorMessage = (errorCode?: string | null) => (
  (errorCode && videoMessages[errorCode])
  || 'Chưa thể tạo video, nhưng bộ ảnh vẫn được giữ lại.'
);
