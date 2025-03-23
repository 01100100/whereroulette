const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
          /netlify[\\/]edge-functions/ // This is the important line to exclude edge functions
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource'
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
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inject: true,
    }),
    new CopyWebpackPlugin({
      patterns: [
        'src/assets/analytics.js'
      ]
    }),
    new FaviconsWebpackPlugin('./src/assets/logo.png')
  ],
  optimization: {
    runtimeChunk: 'single'
  }
};