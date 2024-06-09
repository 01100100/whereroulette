const HtmlWebpackPlugin = require('html-webpack-plugin');
const SaveRemoteFilePlugin = require('save-remote-file-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
  },
  optimization: {
    runtimeChunk: 'single',
  },
  entry: { main: './src/main.ts' },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: [/node_modules/, /\.test\.ts$/],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
        exclude: /input\.css$/,
      },
      {
        test: /\.md$/,
        use: [
          {
            loader: 'html-loader',
            options: {
              esModule: false,
            },
          },
          {
            loader: 'markdown-loader',
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  node: { global: true },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      favicon: './src/assets/favicon.ico',
      inject: true,
    }),
    new SaveRemoteFilePlugin([
      {
        url: 'https://stats.kreuzungen.world/script.js',
        filepath: 'analytics.js',
        hash: false,
      },
    ]),
  ],
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
};