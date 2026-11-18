import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./app";
import { AuthProvider } from "./auth/auth-provider";
import "./styles.css";
import "./site-shell.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#3366ff",
          colorInfo: "#3366ff",
          colorSuccess: "#10b981",
          colorWarning: "#f59e0b",
          colorError: "#ef4444",
          colorText: "#17233b",
          colorTextSecondary: "#52607a",
          colorBorder: "#dbe3f2",
          colorBorderSecondary: "#e6ecf7",
          colorBgLayout: "#f4f7fd",
          borderRadius: 12,
          controlHeight: 44,
          fontFamily:
            '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif',
        },
        components: {
          Input: { activeShadow: "0 0 0 3px #3366ff24" },
          Button: {
            defaultShadow: "none",
            primaryShadow: "0 4px 14px #3366ff30",
          },
          Card: { borderRadiusLG: 16 },
          Table: { headerBg: "#eff4fc", headerColor: "#17233b" },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
