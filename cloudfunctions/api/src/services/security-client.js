const MAX_IMAGE_BYTES = 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif'
]);

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }
  return null;
}

function detectContentType(fileId, buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'GIF8') {
    return 'image/gif';
  }
  const extension = String(fileId || '').split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
  return {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif'
  }[extension] || null;
}

async function loadMedia({ cloud, fileId }) {
  if (typeof cloud.downloadFile !== 'function') {
    throw new Error('云文件下载接口不可用');
  }
  const result = await cloud.downloadFile({ fileID: fileId });
  const buffer = toBuffer(result?.fileContent);
  if (!buffer) throw new Error('云文件内容不可用');
  return buffer;
}

function createSecurityClient({ cloud }) {
  return {
    async checkImage({ fileId }) {
      if (!cloud?.openapi?.security?.imgSecCheck) {
        return { passed: false, traceId: null, reason: '内容安全接口不可用' };
      }
      if (!fileId) {
        return { passed: false, traceId: null, reason: '图片地址不可用' };
      }

      try {
        const buffer = await loadMedia({ cloud, fileId });
        if (buffer.length > MAX_IMAGE_BYTES) {
          return { passed: false, traceId: null, reason: '图片大小不能超过 1MB' };
        }
        const contentType = detectContentType(fileId, buffer);
        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
          return { passed: false, traceId: null, reason: '图片格式不支持，请使用 PNG、JPG、JPEG 或 GIF' };
        }

        const result = await cloud.openapi.security.imgSecCheck({
          media: {
            contentType,
            value: buffer
          }
        });
        const errorCode = result?.errCode ?? result?.errcode;
        const passed = errorCode === 0 || (errorCode === undefined && (result?.errMsg === 'ok' || result?.errmsg === 'ok'));
        return {
          passed,
          traceId: result?.traceId || result?.trace_id || null,
          reason: passed ? null : (result?.errMsg || result?.errmsg || '图片检测未通过')
        };
      } catch (error) {
        console.error('image security check failed', error);
        return {
          passed: false,
          traceId: null,
          reason: error?.errMsg || error?.errmsg || error?.message || '图片检测失败'
        };
      }
    }
  };
}

module.exports = { createSecurityClient };
