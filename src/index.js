export default {
  async fetch(request, env) {
    // 檢查必要的環境變數
    if (!env.OBSIDIAN_IMAGE) {
      console.error('Missing OBSIDIAN_IMAGE binding');
      return new Response('Server configuration error: Missing R2 binding', { status: 500 });
    }
    
    if (!env.IMAGES) {
      console.error('Missing IMAGES binding');
      return new Response('Server configuration error: Missing Images binding', { status: 500 });
    }
    
    const url = new URL(request.url);
    // 使用原始路徑避免自動解碼問題
    const pathname = url.pathname;
    
    // 檢查 If-None-Match header 進行快取控制
    const ifNoneMatch = request.headers.get('If-None-Match');
    const cacheKey = `processed-${pathname.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
    
    // 簡單的 ETag 生成（基於路徑）
    const etag = `"${btoa(pathname).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}"`;
    
    // 解析 URL 路徑：/img-cgi/{size}/{path-to-image-on-R2}
    // 支援浮水印參數：/img-cgi/{size}/watermark/{path-to-image-on-R2}
    const match = pathname.match(/^\/img-cgi\/([^\/]+)(?:\/(watermark))?\/(.+)$/);
    if (!match) {
      return new Response('Invalid URL format. Expected: /img-cgi/{size}[/watermark]/{path-to-image}', { 
        status: 400 
      });
    }
    
    const [, size, watermarkFlag, rawImagePath] = match;
    // 手動解碼圖片路徑，確保正確處理 URL 編碼
    const imagePath = decodeURIComponent(rawImagePath);
    const shouldAddWatermark = watermarkFlag === 'watermark';
    
    // 如果客戶端已有快取，直接返回 304
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }
    
    try {
      // 設定處理超時保護
      const processingTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), 25000) // 25秒超時
      );
      
      // 從 R2 獲取圖片
      const object = await Promise.race([
        env.OBSIDIAN_IMAGE.get(imagePath),
        processingTimeout
      ]);
      if (!object) {
        return new Response('Image not found', { status: 404 });
      }
      
      // 檢查圖片大小，避免處理過大的圖片
      const contentLength = object.size || parseInt(object.httpMetadata?.contentLength) || 0;
      const MAX_SIZE = 50 * 1024 * 1024; // 50MB 限制
      
      if (contentLength > MAX_SIZE) {
        return new Response('Image too large (max 50MB)', { status: 413 });
      }
      
      // 獲取圖片資料
      const imageArrayBuffer = await object.arrayBuffer();
      
      // 根據 size 參數設定轉換選項
      let transformOptions = {};
      
      switch (size) {
        case '320':
          transformOptions = { width: 320 };
          break;
        case '480':
          transformOptions = { width: 480 };
          break;
        case '640':
          transformOptions = { width: 640 };
          break;
        case '768':
          transformOptions = { width: 768 };
          break;
        case '960':
          transformOptions = { width: 960 };
          break;
        case '1280':
          transformOptions = { width: 1280 };
          break;
        case '1920':
          transformOptions = { width: 1920 };
          break;
        case '2560':
          transformOptions = { width: 2560 };
          break;
        case 'thumb':
          transformOptions = { width: 300, height: 200, fit: 'cover' };
          break;
        case 'square':
          transformOptions = { width: 400, height: 400, fit: 'cover' };
          break;
        case 'original':
          // 如果是原圖但要加浮水印
          if (shouldAddWatermark) {
            transformOptions = {}; // 不調整尺寸，只加浮水印
          } else {
            // 不做轉換，直接返回原圖
            return new Response(imageArrayBuffer, {
              headers: {
                'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'ETag': etag,
                'Vary': 'Accept'
              }
            });
          }
          break;
        default:
          // 如果是數字，直接使用作為寬度
          const numericSize = parseInt(size);
          if (!isNaN(numericSize) && numericSize > 0 && numericSize <= 3000) {
            transformOptions = { width: numericSize };
          } else {
            return new Response(`Invalid size parameter: ${size}`, { status: 400 });
          }
      }
      
      // 使用 Cloudflare Images API 進行圖片轉換
      let imageProcessor = env.IMAGES.input(imageArrayBuffer);
      
      // 應用尺寸轉換（如果有）
      if (Object.keys(transformOptions).length > 0) {
        // 根據文檔設定轉換參數
        const transformParams = {};
        
        if (transformOptions.width) transformParams.width = transformOptions.width;
        if (transformOptions.height) transformParams.height = transformOptions.height;
        if (transformOptions.fit) transformParams.fit = transformOptions.fit;
        
        // 使用 scale-down 作為預設的 fit 模式
        if (!transformParams.fit && (transformParams.width || transformParams.height)) {
          transformParams.fit = 'scale-down';
        }
        
        imageProcessor = imageProcessor.transform(transformParams);
      }
      
      // 如果需要加浮水印
      if (shouldAddWatermark) {
        try {
          // 嘗試從 R2 獲取快取的浮水印，如果沒有則從外部 URL 獲取
          let watermarkArrayBuffer;
          const watermarkCacheKey = 'watermark-cache/HappyLee-Logo.png';
          
          try {
            const cachedWatermark = await env.OBSIDIAN_IMAGE.get(watermarkCacheKey);
            if (cachedWatermark) {
              watermarkArrayBuffer = await cachedWatermark.arrayBuffer();
            } else {
              // 如果沒有快取，從外部獲取並快取
              const watermarkResponse = await fetch('https://i.happylee.blog/assets/HappyLee-Logo.png', {
                cf: { cacheTtl: 86400 } // 快取 24 小時
              });
              if (watermarkResponse.ok) {
                watermarkArrayBuffer = await watermarkResponse.arrayBuffer();
                // 非同步快取到 R2，不等待結果
                env.OBSIDIAN_IMAGE.put(watermarkCacheKey, watermarkArrayBuffer, {
                  httpMetadata: { contentType: 'image/png' }
                }).catch(err => console.warn('Failed to cache watermark:', err));
              }
            }
          } catch (cacheError) {
            console.warn('Watermark cache error, using direct fetch:', cacheError);
            const watermarkResponse = await fetch('https://i.happylee.blog/assets/HappyLee-Logo.png');
            if (watermarkResponse.ok) {
              watermarkArrayBuffer = await watermarkResponse.arrayBuffer();
            }
          }
          
          if (watermarkArrayBuffer) {
            
            // 根據圖片大小決定浮水印尺寸和位置
            const imageWidth = transformOptions.width || 1920; // 預設寬度
            let watermarkSize, opacity, position;
            
            if (imageWidth <= 320) {
              // 小圖：小浮水印
              watermarkSize = { width: 40, height: 40 };
              opacity = 0.6;
              position = { bottom: 5, right: 5 };
            } else if (imageWidth <= 640) {
              // 中圖：中等浮水印
              watermarkSize = { width: 60, height: 60 };
              opacity = 0.7;
              position = { bottom: 8, right: 8 };
            } else if (imageWidth <= 1280) {
              // 大圖：較大浮水印
              watermarkSize = { width: 80, height: 80 };
              opacity = 0.8;
              position = { bottom: 12, right: 12 };
            } else {
              // 超大圖：大浮水印
              watermarkSize = { width: 100, height: 100 };
              opacity = 0.8;
              position = { bottom: 15, right: 15 };
            }
            
            // 加上浮水印
            imageProcessor = imageProcessor.draw(
              env.IMAGES.input(watermarkArrayBuffer).transform({
                ...watermarkSize,
                fit: 'contain'
              }),
              {
                opacity: opacity,
                ...position
              }
            );
          }
        } catch (watermarkError) {
          console.warn('Failed to add watermark:', watermarkError);
          // 如果浮水印加載失敗，繼續處理原圖
        }
      }
      
      // 輸出最終圖片，使用 .response() 方法自動處理 headers
      const quality = size === 'thumb' ? 80 : ((transformOptions.width && transformOptions.width >= 1280) ? 90 : 85);
      
      // 根據 Accept header 設定輸出格式，使用完整的 MIME 類型
      const accept = request.headers.get('Accept') || '';
      let outputFormat = 'image/jpeg'; // 預設使用 JPEG
      
      if (/image\/avif/.test(accept)) {
        outputFormat = 'image/avif';
      } else if (/image\/webp/.test(accept)) {
        outputFormat = 'image/webp';
      } else if (/image\/png/.test(accept)) {
        outputFormat = 'image/png';
      }
      
      // 使用正確的 MIME 類型格式，添加超時保護
      const transformedImage = await Promise.race([
        imageProcessor.output({ 
          format: outputFormat,
          quality: quality
        }),
        processingTimeout
      ]);
      
      // 返回轉換後的圖片，添加快取 headers
      const response = transformedImage.response();
      
      // 添加快取控制 headers
      response.headers.set('ETag', etag);
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      response.headers.set('Vary', 'Accept');
      
      return response;
      
    } catch (error) {
      console.error('Image processing error:', error);
      
      // 如果是超時錯誤，返回特定的錯誤訊息
      if (error.message === 'Processing timeout') {
        return new Response('Image processing timeout - image may be too large or complex', { 
          status: 408,
          headers: {
            'Cache-Control': 'no-cache',
            'Retry-After': '60'
          }
        });
      }
      
      return new Response('Internal server error', { status: 500 });
    }
  }
}