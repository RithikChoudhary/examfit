// Minify CSS
const minifyCSS = (css) => {
    return css.replace(/(\s)+/g, ' ')
              .replace(/:\s+/g, ':')
              .replace(/{\s+/g, '{')
              .replace(/}\s+/g, '}');
};

// Minify JavaScript
const minifyJS = (js) => {
    return js.replace(/(\s)+/g, ' ')
             .replace(/(\n)+/g, '')
             .replace(/(\t)+/g, '');
};

// Compress images
const compressImage = async (imageBuffer) => {
    const Sharp = require('sharp');
    return await Sharp(imageBuffer)
        .resize(800, 600, { // Adjust dimensions as needed
            fit: 'inside'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
};