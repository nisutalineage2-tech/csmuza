# CSMuza - CS2 Skin Profit Finder

Extension para Chrome/Firefox que encuentra skins CS2 con profit comparando CSFloat con Steam Market.

## Como funciona

1. Instalas la extension
2. Haces clic en "Abrir Profit Finder"
3. Haces clic en "Escanear CSFloat"
4. Te muestra todas las skins que tienen profit

## Instalacion

### Chrome
1. Descarga este repositorio
2. Abre `chrome://extensions/`
3. Activa "Modo desarrollador"
4. Clic en "Cargar extension sin empaquetar"
5. Selecciona la carpeta de esta extension

### Firefox
1. Descarga este repositorio
2. Abre `about:debugging#/runtime/this-firefox`
3. Clic en "Cargar componente temporal"
4. Selecciona el archivo `manifest.json`

## Auto-actualizacion

La extension verifica automaticamente si hay nuevas versiones en GitHub. Cuando haya una actualizacion disponible, aparecera un banner en el popup para descargarla.

## Configuracion

- **Profit Minimo (%)**: Filtra skins con menos profit
- **Precio Maximo (USD)**: Solo busca skins hasta ese precio
- **Auto-escaneo**: Muestra badges de profit en CSFloat
