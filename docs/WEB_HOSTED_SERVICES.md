# Web Hosted Services

## Overview

In **web mode**, HuntMaps automatically uses hosted map services (like OnX or Google Maps) - **no file uploads required!** The app works immediately without any setup.

## How It Works

### Desktop (Electron) Mode
- Uses local MBTiles files from your project directory
- Requires project setup and tile files
- Offline-capable

### Web Mode  
- **Automatically uses hosted services** - works instantly!
- No uploads, no setup, no files needed
- Just open the app and start mapping

## Hosted Services Used

### Base Maps
- **Topo**: USGS Topographic Maps
- **Aerial**: USGS Imagery

### Terrain Layers
- **Hillshade**: Esri World Shaded Relief (automatic in web mode)
- **Slope**: Esri World Topo Map (automatic in web mode)

## Optional: Local Tiles

If you want to use your own MBTiles files in web mode (to override the hosted services), you can:

1. Open the Basemaps panel
2. Scroll to "Local Tiles (Optional)" section
3. Click "Load File" for hillshade or slope
4. Select your `.mbtiles` file

Your local tiles will override the hosted services for that layer.

## Benefits

✅ **Zero setup** - Works immediately in browser  
✅ **No file uploads** - Maps load automatically  
✅ **Always up-to-date** - Uses latest hosted imagery  
✅ **Fast** - No parsing or storage needed  
✅ **Simple** - Just like OnX or Google Maps  

## Service Providers

- **USGS**: National Map services (topo, aerial)
- **Esri**: World terrain and hillshade services
- All services are free and publicly available

## Notes

- Hosted services require internet connection
- For offline use, use Electron desktop app with local MBTiles
- Local tiles (if loaded) take precedence over hosted services
- Service worker is still available for local tile serving if needed

