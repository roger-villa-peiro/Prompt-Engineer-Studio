// vite.config.ts
import path from "path";
import { defineConfig, loadEnv } from "file:///E:/descargas/prompt-engineer-studio/node_modules/vite/dist/node/index.js";
import react from "file:///E:/descargas/prompt-engineer-studio/node_modules/@vitejs/plugin-react/dist/index.js";
import { visualizer } from "file:///E:/descargas/prompt-engineer-studio/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "E:\\descargas\\prompt-engineer-studio";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3e3,
      host: "0.0.0.0",
      proxy: {
        "/api": "http://localhost:3001"
      }
    },
    plugins: [
      react(),
      visualizer({
        filename: "stats.html",
        open: false,
        // Set to true to auto-open after build
        gzipSize: true,
        brotliSize: true
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, ".")
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxkZXNjYXJnYXNcXFxccHJvbXB0LWVuZ2luZWVyLXN0dWRpb1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRTpcXFxcZGVzY2FyZ2FzXFxcXHByb21wdC1lbmdpbmVlci1zdHVkaW9cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0U6L2Rlc2Nhcmdhcy9wcm9tcHQtZW5naW5lZXItc3R1ZGlvL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyB2aXN1YWxpemVyIH0gZnJvbSAncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsICcuJywgJycpO1xuICByZXR1cm4ge1xuICAgIHNlcnZlcjoge1xuICAgICAgcG9ydDogMzAwMCxcbiAgICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICAgIHByb3h5OiB7XG4gICAgICAgICcvYXBpJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMSdcbiAgICAgIH1cbiAgICB9LFxuICAgIHBsdWdpbnM6IFtcbiAgICAgIHJlYWN0KCksXG4gICAgICB2aXN1YWxpemVyKHtcbiAgICAgICAgZmlsZW5hbWU6ICdzdGF0cy5odG1sJyxcbiAgICAgICAgb3BlbjogZmFsc2UsIC8vIFNldCB0byB0cnVlIHRvIGF1dG8tb3BlbiBhZnRlciBidWlsZFxuICAgICAgICBnemlwU2l6ZTogdHJ1ZSxcbiAgICAgICAgYnJvdGxpU2l6ZTogdHJ1ZSxcbiAgICAgIH0pLFxuICAgIF0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLicpLFxuICAgICAgfVxuICAgIH1cbiAgfTtcbn0pO1xuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlTLE9BQU8sVUFBVTtBQUNsVCxTQUFTLGNBQWMsZUFBZTtBQUN0QyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxrQkFBa0I7QUFIM0IsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxLQUFLLEVBQUU7QUFDakMsU0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixXQUFXO0FBQUEsUUFDVCxVQUFVO0FBQUEsUUFDVixNQUFNO0FBQUE7QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLFlBQVk7QUFBQSxNQUNkLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxHQUFHO0FBQUEsTUFDbEM7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
