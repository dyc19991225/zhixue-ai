import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./app";
import { AuthProvider } from "./auth/auth-provider";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#175cde",
          borderRadius: 14,
          controlHeight: 44,
          fontFamily:
            '"Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif',
        },
        components: {
          Input: { activeShadow: "0 0 0 3px #175cde20" },
          Button: { defaultShadow: "none" },
        },
      }}
    >
      <AntApp>
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
