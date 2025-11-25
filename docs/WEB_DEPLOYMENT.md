# Web Deployment Guide

HuntMaps is now a web-only application. This document covers building and hosting the SPA.

## Building for Web

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Web Platform Features

### File Storage

Projects are saved locally in the browser (IndexedDB/localStorage). The app also uses:
- **IndexedDB** for map data and media metadata
- **Blob URLs** for media playback
- **Service worker** for hosted tile caching

### Tile Serving

Hosted terrain/imagery tiles are cached by the service worker. Optional MBTiles uploads are stored in IndexedDB and served through `/api/tiles/...`.

## Limitations

### Current Web Limitations

1. **Cloud save/load** – API scaffold exists but persistence is still in progress.
2. **Offline packs** – Desktop-only feature removed; web support planned.
3. **GeoPackage/PDF export** – Browser-only implementations with limited styling.
4. **Video conversion** – Browser cannot transcode .avi → .mp4 (use compatible formats).

### Browser Compatibility

- **File System Access API**: Chrome/Edge 86+, Opera 72+
- **IndexedDB**: All modern browsers
- **Service Workers**: All modern browsers

## Deployment Options

### Static Hosting

For static hosting (Netlify, Vercel, GitHub Pages):

1. Build the app: `npm run build`
2. Deploy the `dist/` directory
3. Configure redirects for SPA routing

### Server Deployment

For server deployment (Node.js, etc.):

1. Build the app: `npm run build`
2. Serve static files from `dist/`
3. Add any optional API endpoints you need (e.g., MBTiles hosting)

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Future Enhancements

- [ ] Full cloud project persistence (snapshots, restore)
- [ ] Offline pack builder for web
- [ ] Collaborative editing
- [ ] Progressive Web App (PWA) install experience

## Troubleshooting

### Tiles Not Loading

- Check service worker registration
- Verify MBTiles are uploaded (if overriding hosted tiles)
- Check browser console for errors
- Ensure CORS is configured if using external tiles

### File Operations Failing

- Ensure Supabase credentials are configured
- Check browser storage quotas / service-worker logs

### Media Not Displaying

- Verify Blob URLs are created correctly
- Confirm the file format is supported by the browser video element

