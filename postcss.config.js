const { PurgeCSS } = require('purgecss');

module.exports = {
  plugins: [
    {
      postcssPlugin: 'purgecss',
      Once: async (root, { result }) => {
        const purgeCSSResult = await new PurgeCSS().purge({
          content: ['./views/**/*.ejs', './public/**/*.js'],
          css: [{ raw: root.toString() }],
          defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
        });

        root.removeAll();
        root.append(purgeCSSResult[0].css);
      }
    }
  ]
};
