import { Link } from "react-router-dom";
import { FeedbackInbox } from "@/features/feedback/feedback-inbox";
import { useAuth } from "@/auth/auth-provider";
export default function AdminFeedback() {
  const { user } = useAuth();
  return (
    <section className="wrap account-page">
      <h1>试用反馈管理</h1>
      <p className="intro">
        查看提交内容，记录检查结果并更新处理进度。处理说明对提交人可见。
      </p>
      <Link className="text-link" to="/admin">
        返回管理员工作台
      </Link>
      <FeedbackInbox admin key={user?.id} />
    </section>
  );
}
