# 《绝句》草堂春望 · 验收记录

日期：2026-10-13。源码使用 React、TypeScript、Three.js，生产页面由 Vite preview 实际启动。

## 作品与空间映射

原文核对自[香港教育局建议篇章《绝句》](https://www.edb.gov.hk/attachment/tc/curriculum-development/kla/chi-edu/recommended-passages/ks2_11_text.pdf)，采用简体字，保留四个独立诗句及原标点。

| ID | 诗句 | 所在区域与镜头 | 桌面截图 |
|---|---|---|---|
| `overview` | 全景 | 草堂、柳岸、江水与西岭的空间关系 | [全景](screenshots/01-overview.png) |
| `orioles` | 两个黄鹂鸣翠柳， | 柳树前方近景，两只黄鹂可同时辨认 | [黄鹂](screenshots/02-orioles.png) |
| `egrets` | 一行白鹭上青天。 | 从同一河谷仰望七只白鹭组成的队列 | [白鹭](screenshots/03-egrets.png) |
| `window` | 窗含西岭千秋雪， | 草堂内部，透过真实开放窗框看完整雪峰 | [窗与雪](screenshots/04-window.png) |
| `boats` | 门泊东吴万里船。 | 河岸近景，码头旁停泊的木船、船舱与帆 | [泊船](screenshots/05-boats.png) |

草堂形制、庭院、花草、码头、船只造型与河道属于视觉补充。地理距离经过压缩，表达近处春色与远处雪山、门前泊船与远行之间的关系。黄鹂鸣唱以姿态呈现，无音频。

## 实际检查

- `pnpm lint`：Biome 格式、导入顺序和推荐 lint 规则通过。
- `pnpm build`：严格 TypeScript 检查与生产构建通过。
- `pnpm qa http://127.0.0.1:4175/ http://127.0.0.1:5175/`：50 项浏览器断言通过。机器结果保存在 [qa-results.json](qa-results.json)。
- 首帧实际绘制后才移除加载状态；逐句截图已人工复看，主体景物可辨认，选中项与镜头一致，四个视角复用相同 `sceneId`。
- 连续快速选句、飞行中拖动、按住鼠标时改选、白鹭仰望镜头切回泊船、返回全景、手动旋转、滚轮缩放均通过。
- 暂停冻结风物时间，继续后恢复；暂停保留镜头导航。系统与手动减少动态均直接选景，并停止非必要动画。
- Tab 按原句序移动，Enter 激活诗句；出处弹窗保留全文，Escape 可关闭。
- 模拟断开图形连接后显示恢复提示，全文仍可读；连接恢复复用原场景。点击重新载入后销毁旧场景，只保留一个画布。
- 通过注入拒绝 WebGL 的独立浏览器会话验证不可用提示、完整诗文与重试入口；该测试 fixture 不进入生产构建。
- 开发页面实际经历 React StrictMode 初始化与清理，最终仅一个画布，持续绘制且无未捕获异常。
- 正常生产路径最终无 `console.error` 或未捕获异常；故障注入的 context lost/restored 日志保留在机器记录。

## 浏览器与画幅

桌面使用 Chromium 151、1440 × 960，平板画幅检查 1024 × 768。渲染后端为 Apple M4 / ANGLE Metal。

手机使用 Chromium 的 iPhone 14 模拟：390 × 844、触控指针与设备像素密度。分别切换四句并截图，验证选句后整块景观可见；原生 CDP 触控事件验证单指旋转和双指缩放，另检查 320 × 740 无横向溢出。手机渲染密度封顶为 1，关闭阴影并减少植被。

- [手机全页](screenshots/06-mobile-overview.png)
- [黄鹂](screenshots/mobile-orioles.png)、[白鹭](screenshots/mobile-egrets.png)、[窗景](screenshots/mobile-window.png)、[泊船](screenshots/mobile-boats.png)
- [图形不可用](screenshots/07-graphics-fallback.png)

自动化优先使用 agent-browser；其当前版本的滚轮命令将坐标发送到页面原点，测试改用该会话的 CDP 接口指定画布坐标。触控手势也通过 CDP 发入真实浏览器，未直接修改相机状态。

无障碍自动检查确认违规为 0；动态画布背景与部分短分隔符的对比度检查仍有 1 类人工复核项，不等同于完整 WCAG 认证。真实手机、Safari 与其他 GPU 尚未验证；桌面设备模拟不能证明移动硬件性能。

## 本机渲染采样

四个桌面镜头记录约 60 FPS；黄鹂、白鹭、窗景、泊船分别为 60、111、8、17 次绘制调用，约 41 万三角形。数据来自本次机器采样，不作为其他设备的性能承诺。

## 本地地址与复现

生产预览：<http://127.0.0.1:4175/>。开发服务：<http://127.0.0.1:5175/>。

```sh
pnpm install
pnpm lint
pnpm build
pnpm preview --port 4175 --strictPort
# 另一个终端，可选启动开发服务再检查 StrictMode：
pnpm dev --port 5175 --strictPort
pnpm qa http://127.0.0.1:4175/ http://127.0.0.1:5175/
```

本次完成本地实现与验证，源码和验收材料保存在当前工作区。
