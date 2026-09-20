const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecurityClient } = require('../src/services/security-client');

test('image checks download cloud files and send the required media payload', async () => {
  let request;
  const fileContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const cloud = {
    async downloadFile({ fileID }) {
      assert.equal(fileID, 'cloud://env/card-drafts/card-mu6szxgb-hbyh8a');
      return { fileContent };
    },
    openapi: {
      security: {
        async imgSecCheck(payload) {
          request = payload;
          return { errCode: 0, traceId: 'trace-1' };
        }
      }
    }
  };

  const result = await createSecurityClient({ cloud }).checkImage({
    fileId: 'cloud://env/card-drafts/card-mu6szxgb-hbyh8a'
  });

  assert.equal(request.media.contentType, 'image/png');
  assert.deepEqual(request.media.value, fileContent);
  assert.deepEqual(result, { passed: true, traceId: 'trace-1', reason: null });
});
