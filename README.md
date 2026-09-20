# Cardory

微信小程序抽卡项目骨架，包含 `miniprogram` 前端和 `cloudfunctions/api` 云函数。

## API tests

```powershell
Set-Location cloudfunctions/api
npm install
npm test
```

云函数事件格式为 `{ action, payload }`，返回统一的成功或错误结果。
