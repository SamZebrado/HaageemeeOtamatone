# 橘猫电音蝌蚪（Otamatone）
# Orange Cat Otamatone

这是一个可触摸的 Otamatone 风格网页乐器，支持滑杆音高、猫头嘴巴 wah、特效与直播回复面板。
This is a touch-friendly Otamatone-style web instrument with pitch ribbon, cat mouth wah, effects, and a livestream reply panel.

## 主要功能
## Key Features
- 滑杆控制音高，支持多指操作。
- Pitch ribbon control with multi-touch support.
- 猫头嘴巴开合与 wah 联动，表情会随音高变化。
- Cat mouth opening with wah linkage, expressions react to pitch.
- 可选特效（烟花/星屑/光晕），与弹奏相关联。
- Selectable effects (fireworks/sparkles/glow) linked to playing.
- 自动弹奏：曲目选择、播放/停止、循环、速度倍率。
- Auto play: song select, play/stop, loop, speed multiplier.
- 眼睛颜色可调，设定会保存到本地。
- Adjustable eye color with local persistence.
- 右侧控制区+粉丝回复草稿（自动保存）。
- Right-side controls + reply draft (auto-saved).

## 使用方法
## How to Use
- 点击“启用声音”后开始演奏。
- Click “Enable Sound” to start playing.
- 按住滑杆上下滑动改变音高。
- Hold and slide the ribbon to change pitch.
- 按住猫头上下拖动改变嘴巴开合（wah）。
- Drag the head up/down to change mouth opening (wah).
- 进入“配置位置”可拖动滑杆整体位置。
- In “Configure Position”, drag the ribbon to reposition it.
- 点击“全屏”进入沉浸模式。
- Click “Fullscreen” for immersive mode.
- 选择曲目并点击“播放”自动弹奏（需先解锁音频）。
- Select a song and click “Play” to auto-play (audio unlock required).

## 局域网访问（平板/手机）
## Local Network Access (Tablet/Phone)
在项目目录执行：
Run in the project directory:
```
python3 -m http.server 8000 --bind 0.0.0.0
```
在同一 Wi‑Fi 下访问：
Open on the same Wi‑Fi:
```
http://<你的电脑局域网IP>:8000
```

## 文件结构
## File Structure
- `index.html`：结构与 UI。
- `index.html`: Structure and UI.
- `style.css`：样式与猫头绘制。
- `style.css`: Styling and cat head drawing.
- `app.js`：音频引擎与交互逻辑。
- `app.js`: Audio engine and interaction logic.
- `songs_data.js`：内联曲库数据（离线可用）。
- `songs_data.js`: Inlined song library (offline-ready).

## 说明
## Notes
- 浏览器刷新会退出全屏，轻触一次可自动恢复。
- Fullscreen exits on refresh; one tap restores it.
- 特效在设备性能较低时会自动降频绘制。
- Effects are throttled on lower-performance devices.
- 自动弹奏曲库来自 `otamatone_pd_songpack/songs` 并已内联。
- Auto-play songs are sourced from `otamatone_pd_songpack/songs` and inlined.
- 形象仍需完善，但作者已无能为力（欢迎后续优化）。
- The mascot still needs polish, but the author has reached their limit (PRs welcome).

## 许可证
## License
如需添加许可证，请在此处补充。
Add a license here if needed.
