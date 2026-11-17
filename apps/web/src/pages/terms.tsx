import { PlaceholderPage } from "@/components/placeholder-page";
export default function Page() {
  return (
    <PlaceholderPage
      title="使用说明 · 原型版"
      description="当前版本用于本地体验与产品结构验证。"
      items={[
        "示例目录与未来功能说明不代表课程或服务已交付。",
        "当前不提供正式教学服务、会员交易或 AI 答疑。",
        "运营主体、服务条款、内容权属与上线要求需后续确认。",
      ]}
    />
  );
}
