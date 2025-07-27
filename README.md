# Image Transform Worker

一個基於 Cloudflare Worker 的圖片轉換服務，整合 R2 儲存和 Images API，提供高效能的圖片處理功能。

## 🎯 功能特色

- 🖼️ **多尺寸圖片轉換**: 支援預設尺寸和自訂數值
- 💧 **智慧浮水印**: 根據圖片尺寸自動調整浮水印大小和位置
- 📦 **R2 整合**: 直接從 Cloudflare R2 儲存讀取圖片
- 🚀 **格式自動協商**: 根據瀏覽器支援自動選擇最佳格式 (AVIF/WebP/JPEG)
- ⚡ **邊緣快取**: 利用 Cloudflare 全球網路加速圖片載入
- 🛡️ **路徑參數**: 使用 RESTful 風格的 URL 設計

## 🔧 技術架構

- **Runtime**: Cloudflare Workers
- **儲存**: Cloudflare R2 (`obsidian-image` bucket)
- **圖片處理**: Cloudflare Images API (binding)
- **自訂域名**: `happylee.blog/img-cgi/*`

## 📖 API 使用說明

### URL 格式

```
https://happylee.blog/img-cgi/{size}[/watermark]/{path-to-image}
```

### 支援的尺寸參數 {size}

#### 預設尺寸
- `320`, `480`, `640`, `768`, `960`, `1280`, `1920`, `2560` - 對應像素寬度
- `thumb` - 縮圖 (300x200, cover 模式)
- `square` - 正方形 (400x400, cover 模式)
- `original` - 原始尺寸

#### 自訂尺寸
- 任何 1-3000 之間的數字作為寬度 (例如: `360`, `1200`)

### 浮水印選項 {watermark}

在尺寸參數後加上 `/watermark` 即可添加浮水印：

```
https://happylee.blog/img-cgi/640/watermark/your-image.jpg
```

浮水印會根據圖片尺寸自動調整：
- **≤320px**: 40x40px 浮水印，透明度 60%
- **≤640px**: 60x60px 浮水印，透明度 70%
- **≤1280px**: 80x80px 浮水印，透明度 80%
- **>1280px**: 100x100px 浮水印，透明度 80%

## 💡 使用範例

### 基本 URL 範例

```bash
# 基本尺寸轉換
https://happylee.blog/img-cgi/640/photo.jpg

# 自訂尺寸
https://happylee.blog/img-cgi/360/photo.jpg

# 縮圖模式
https://happylee.blog/img-cgi/thumb/photo.jpg

# 正方形裁切
https://happylee.blog/img-cgi/square/photo.jpg

# 加浮水印
https://happylee.blog/img-cgi/1280/watermark/photo.jpg

# 原圖 + 浮水印
https://happylee.blog/img-cgi/original/watermark/photo.jpg

# 縮圖 + 浮水印
https://happylee.blog/img-cgi/thumb/watermark/photo.jpg
```

### 📱 部落格響應式圖片用法

在部落格中使用響應式圖片，讓不同設備載入最適合的尺寸：

#### 基本響應式圖片

```html
<img 
  src="https://happylee.blog/img-cgi/768/your-image.jpg"
  srcset="
    https://happylee.blog/img-cgi/320/your-image.jpg 320w,
    https://happylee.blog/img-cgi/480/your-image.jpg 480w,
    https://happylee.blog/img-cgi/640/your-image.jpg 640w,
    https://happylee.blog/img-cgi/768/your-image.jpg 768w,
    https://happylee.blog/img-cgi/1280/your-image.jpg 1280w,
    https://happylee.blog/img-cgi/1920/your-image.jpg 1920w
  "
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
  alt="圖片描述"
  loading="lazy"
/>
```

#### 帶浮水印的響應式圖片

```html
<img 
  src="https://happylee.blog/img-cgi/768/watermark/your-image.jpg"
  srcset="
    https://happylee.blog/img-cgi/320/watermark/your-image.jpg 320w,
    https://happylee.blog/img-cgi/480/watermark/your-image.jpg 480w,
    https://happylee.blog/img-cgi/640/watermark/your-image.jpg 640w,
    https://happylee.blog/img-cgi/768/watermark/your-image.jpg 768w,
    https://happylee.blog/img-cgi/1280/watermark/your-image.jpg 1280w,
    https://happylee.blog/img-cgi/1920/watermark/your-image.jpg 1920w
  "
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
  alt="圖片描述"
  loading="lazy"
/>
```

#### 🎯 sizes 屬性說明

- `(max-width: 768px) 100vw`: 螢幕寬度 ≤ 768px 時，圖片佔滿整個視窗寬度
- `(max-width: 1200px) 80vw`: 螢幕寬度 768px-1200px 時，圖片佔 80% 視窗寬度  
- `1200px`: 螢幕寬度 > 1200px 時，圖片最大寬度為 1200px

#### 💡 最佳實踐建議

1. **總是提供 `src` 作為後備**: 不支援 srcset 的瀏覽器會使用 src
2. **使用 `loading="lazy"`**: 延遲載入非首屏圖片，提升頁面載入速度
3. **合理設定 `sizes`**: 根據你的網站佈局調整 sizes 屬性
4. **考慮 2x 顯示器**: 高解析度螢幕可能需要更大的圖片
5. **加上有意義的 `alt` 文字**: 提升無障礙性和 SEO

## 🛠️ 開發環境設定

### 安裝依賴

```bash
npm install
```

### 本地開發

```bash
npm run dev
```

### 部署到 Cloudflare

```bash
npm run deploy
```

## ⚙️ 配置說明

### wrangler.toml 重要設定

```toml
# R2 儲存綁定
[[env.production.r2_buckets]]
binding = "OBSIDIAN_IMAGE"
bucket_name = "obsidian-image"

# Images API 綁定
[env.production.images]
binding = "IMAGES"

# 自訂域名路由
[[env.production.routes]]
pattern = "happylee.blog/img-cgi/*"
zone_name = "happylee.blog"
```

### 環境變數

- `OBSIDIAN_IMAGE`: R2 bucket 綁定名稱
- `IMAGES`: Cloudflare Images API 綁定名稱

## 🔍 重要技術細節

### 圖片格式處理

使用 Cloudflare Images API 的 `.output()` 方法時，**必須使用完整的 MIME 類型**：
- ✅ 正確: `"image/jpeg"`, `"image/webp"`, `"image/avif"`
- ❌ 錯誤: `"jpeg"`, `"webp"`, `"avif"`

### 轉換參數

根據 [Cloudflare Images Transform 文檔](https://developers.cloudflare.com/images/transform-images/transform-via-workers/#fetch-options)，支援的轉換參數包括：
- `width`: 目標寬度
- `height`: 目標高度  
- `fit`: 縮放模式 (`scale-down`, `contain`, `cover`, `crop`, `pad`)
- `quality`: 圖片品質 (1-100)

### 浮水印實作

使用 Images API 的 `.draw()` 方法：
```javascript
imageProcessor.draw(
  env.IMAGES.input(watermarkBuffer).transform({
    width: 80,
    height: 80,
    fit: 'contain'
  }),
  {
    opacity: 0.8,
    bottom: 12,
    right: 12
  }
);
```

## 📁 專案結構

```
image-transform-worker/
├── src/
│   └── index.js          # 主程式 (Worker 邏輯)
├── wrangler.toml         # Cloudflare Worker 設定
├── package.json          # 專案依賴
└── README.md            # 專案說明
```

## 🐛 故障排除

### 常見錯誤

1. **IMAGES_TRANSFORM_ERROR 9432: Bad request: invalid output format**
   - 原因: 使用了錯誤的格式名稱
   - 解決: 使用完整 MIME 類型 (如 `"image/jpeg"`)

2. **Image not found (404)**
   - 原因: R2 bucket 中不存在指定檔案
   - 解決: 檢查檔案路徑和 bucket 內容

3. **Cannot read properties of undefined (reading 'input')**
   - 原因: Images binding 未正確設定
   - 解決: 檢查 `wrangler.toml` 中的 `[images]` 設定

### 除錯方法

```bash
# 查看即時日誌
npx wrangler tail --env production

# 檢查 R2 bucket 內容
npx wrangler r2 bucket info obsidian-image --remote

# 測試特定檔案
npx wrangler r2 object get obsidian-image/your-file.jpg --file test.jpg --remote
```

## 📊 效能考量

- **AVIF 限制**: 圖片寬度/高度超過 1200px 時會自動降級為 WebP
- **WebP 限制**: 有損壓縮限制 2560px，無損壓縮限制 1920px  
- **圖片大小**: 最大 70MB，最大面積 100 megapixels
- **快取**: 轉換後的圖片會自動快取在 Cloudflare 邊緣節點

## 🔮 未來擴展

可考慮的功能擴展：
1. **批次處理**: 支援多張圖片同時轉換
2. **更多浮水印選項**: 位置、樣式、文字浮水印
3. **圖片效果**: 模糊、銳化、色彩調整
4. **統計分析**: 使用量統計和效能監控
5. **API 金鑰**: 存取控制和使用限制

## 📄 授權

MIT License 