from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
def icon(size):
    image = Image.new('RGB', (size, size), '#182c40')
    draw = ImageDraw.Draw(image)
    for x, top in [(0.29, 0.52), (0.47, 0.37), (0.65, 0.22)]:
        draw.rounded_rectangle((int(x*size), int(top*size), int((x+.075)*size), int(.76*size)), radius=max(2,int(.0375*size)), fill='#b4f18b')
    return image
icon(512).save(root/'public/app-icon.png')
icon(256).save(root/'public/app-icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
for folder, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    target=root/f'android/app/src/main/res/mipmap-{folder}'
    for name in ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png']:
        icon(size if name != 'ic_launcher_foreground.png' else size*2).save(target/name)
for target in (root/'ios/App/App/Assets.xcassets/AppIcon.appiconset').glob('*.png'):
    icon(1024).save(target)

