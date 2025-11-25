# Migration to Web - Summary

This document summarizes the changes made to enable web deployment of HuntMaps.

## What Was Done

### 1. Open Source Preparation ✅

- **README.md** - Comprehensive project documentation
- **LICENSE** - MIT License file
- **CONTRIBUTING.md** - Contribution guidelines
- **package.json** - Updated to be public, added web build scripts

### 2. Platform Abstraction Layer ✅

Created `src/lib/platform/` with:
- **index.ts** - Platform detection and unified API interface
- **web.ts** - Web implementation using browser APIs

This allows the app to work in both Electron and web environments without code changes.

### 3. Web API Implementation ✅

Implemented web versions of:
- File dialogs (using `<input type="file">`)
- File storage (IndexedDB + File System Access API)
- Media handling (Blob URLs)
- Project management (IndexedDB)

### 4. MBTiles Web Support ✅

Updated `src/lib/mbtiles/client.ts` to:
- Detect platform (Electron vs Web)
- Return appropriate URL format
- Web mode uses HTTP endpoints (requires service worker/server)

### 5. Build Configuration ✅

Added scripts:
- `npm run dev:web` - Web development server
- `npm run build:web` - Web production build
- `npm run preview` - Preview production build

## How to Use

### For Developers

**Desktop Development:**
```bash
npm run dev
```

**Web Development:**
```bash
npm run dev:web
```

**Using the Platform API:**

Instead of calling `window.api` directly, use the platform abstraction:

```typescript
// ❌ Old way (Electron only)
await window.api.readTextFile(projectPath, "data/hunts.geojson");

// ✅ New way (works in both)
import { readTextFile } from "../lib/platform";
await readTextFile(projectPath, "data/hunts.geojson");
```

### Migration Checklist

To migrate existing code to use the platform abstraction:

1. **Find direct `window.api` usage:**
   ```bash
   grep -r "window.api" src/
   ```

2. **Replace with platform imports:**
   ```typescript
   // Before
   import ...;
   await window.api.someMethod(...);
   
   // After
   import { someMethod } from "../lib/platform";
   await someMethod(...);
   ```

3. **Update type definitions:**
   - `window.api` is now optional (for web compatibility)
   - Use platform abstraction functions instead

## Current Status

### ✅ Working
- Platform detection
- File dialogs (web fallback)
- File storage (IndexedDB)
- Basic project structure creation
- Build configuration

### ⚠️ Needs Implementation
- **MBTiles tile serving** - Requires service worker or server
- **Video conversion** - Not available in browser (needs server)
- **GeoPackage export** - Needs browser-compatible library
- **PDF generation** - Currently simplified (downloads PNG)

### 🔄 Partial Implementation
- **Media files** - Basic blob URL support, needs full implementation
- **File System Access API** - Implemented but needs testing
- **Project persistence** - IndexedDB storage works, needs handle persistence

## Next Steps

### Immediate
1. **Test web build** - Ensure it compiles and runs
2. **Implement service worker** - For MBTiles tile serving
3. **Update components** - Migrate from `window.api` to platform abstraction

### Short Term
1. **Add web dependencies** - jsPDF for PDF, browser-compatible GeoPackage library
2. **Improve media handling** - Full blob URL management
3. **Add PWA support** - Service worker, manifest, offline support

### Long Term
1. **Cloud storage integration** - Sync projects to cloud
2. **Server-side features** - Video conversion, advanced exports
3. **Mobile optimization** - Responsive design, touch gestures

## Architecture

```
┌─────────────────────────────────────┐
│         Application Code             │
│  (Components, State, Business Logic) │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Platform Abstraction Layer     │
│    (src/lib/platform/index.ts)      │
└──────────────┬───────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌─────────────┐  ┌─────────────┐
│   Electron  │  │     Web     │
│   (window.  │  │ (IndexedDB, │
│    api)     │  │  Blob URLs) │
└─────────────┘  └─────────────┘
```

## Testing

### Desktop Testing
```bash
npm run dev
# Test all features in Electron
```

### Web Testing
```bash
npm run dev:web
# Open http://localhost:5173
# Test in browser DevTools
```

### Production Testing
```bash
npm run build:web
npm run preview
# Test production build
```

## Known Issues

1. **Type Safety** - Some `window.api` calls use `!` assertion (needs migration)
2. **Error Handling** - Web implementations need better error messages
3. **File Handles** - File System Access API handles can't be persisted
4. **Performance** - IndexedDB may be slower than file system for large files

## Resources

- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web Deployment Guide](./WEB_DEPLOYMENT.md)

