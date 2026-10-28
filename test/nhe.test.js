import test from 'node:test';
import assert from 'node:assert/strict';
import { giuNeuKhongDoi } from '../src/utils/lamMoi.js';
import { anhVideoCloudinary } from '../src/utils/anhCloudinary.js';

// ── Làm mới 30 giây: dữ liệu không đổi thì giữ ĐÚNG mảng cũ (React bỏ qua vẽ lại) ──

test('giuNeuKhongDoi: cùng nội dung → trả lại đúng tham chiếu cũ', () => {
  const cu = [{ Ma_Can: 'T01', Gia: '5 tỷ' }, { Ma_Can: 'T02', Gia: '6 tỷ' }];
  const moi = [{ Ma_Can: 'T01', Gia: '5 tỷ' }, { Ma_Can: 'T02', Gia: '6 tỷ' }];
  assert.equal(giuNeuKhongDoi(cu, moi), cu);
});

test('giuNeuKhongDoi: có ô đổi → lấy bản mới', () => {
  const cu = [{ Ma_Can: 'T01', Gia: '5 tỷ' }];
  const moi = [{ Ma_Can: 'T01', Gia: '5,2 tỷ' }];
  assert.equal(giuNeuKhongDoi(cu, moi), moi);
});

test('giuNeuKhongDoi: thêm / bớt dòng → lấy bản mới', () => {
  const cu = [{ Ma_Can: 'T01' }];
  assert.equal(giuNeuKhongDoi(cu, []).length, 0);
  assert.equal(giuNeuKhongDoi(cu, [...cu, { Ma_Can: 'T02' }]).length, 2);
});

// ── Ảnh đại diện cho video Cloudinary (ô thu nhỏ không tải file video gốc) ──

const VID = 'https://res.cloudinary.com/demo/video/upload/v1712345678/quy/can_t01.mp4';

test('anhVideoCloudinary: đổi đuôi sang .jpg + thu nhỏ', () => {
  assert.equal(anhVideoCloudinary(VID, 64),
    'https://res.cloudinary.com/demo/video/upload/q_auto,w_64,c_limit/v1712345678/quy/can_t01.jpg');
});

test('anhVideoCloudinary: video không phải Cloudinary / ảnh thường → null (dùng <video>)', () => {
  assert.equal(anhVideoCloudinary('https://example.com/a.mp4', 64), null);
  assert.equal(anhVideoCloudinary('https://res.cloudinary.com/demo/image/upload/v1/a.jpg', 64), null);
  assert.equal(anhVideoCloudinary(null, 64), null);
});

test('anhVideoCloudinary: đã có tham số sẵn thì không chèn chồng', () => {
  assert.equal(anhVideoCloudinary('https://res.cloudinary.com/demo/video/upload/w_100/v1/a.mp4', 64), null);
});

test('anhVideoCloudinary: giữ chuỗi ?query', () => {
  assert.equal(anhVideoCloudinary('https://res.cloudinary.com/demo/video/upload/v1/a.mov?x=1', 32),
    'https://res.cloudinary.com/demo/video/upload/q_auto,w_32,c_limit/v1/a.jpg?x=1');
});
