> 本文件为故障处理历史。后续已恢复原服务并完成VPS隧道预览部署，最终状态以vps-deployment.md为准。

# 知学 AI VPS 部署进度

2026-11-08（北京时间）。目标：SSH 别名vps，192.74.249.13:22491，用户授权部署；域名未定。当前未交付可用站点。

已完成：
- 构建生产前后端，发布包上传 /opt/zhixue-ai/releases/20261108。
- 本地最新数据库备份：work/backups/zhixue-2026-11-08T05-44-49-759Z.dump；服务器备份 /opt/zhixue-ai/backups/initial-20261108.dump，未恢复。
- 本地核对15门课程（3已发布）、130道题（0已发布）；无媒体文件。发布状态不得自动改变。
- 创建隔离的zhixue用户、zhixue-vps Compose项目、独立数据卷和systemd配置。API18400、网页18180、DB15433、Redis16389均仅127.0.0.1。
- 原/etc/caddy/Caddyfile未修改，正式域名与公网入口未配置。
- 新runtime.env仅root可读，独立生成服务器配置，未复制本机凭据。AI关闭，本机WorkBuddy路由不直接用于VPS。

阻塞与收尾：
- npm安装与首次容器启动期间，主机出现大量rq_qos_wait磁盘等待，负载约50，SSH握手超时；内存仍有余量。
- 取消首次npm，重试低并发（CPU25%、384MB、IOWeight10、线程1）后仍反复阻塞。安装不完整，不能启动API。
- 临时测试vda/queue/wbt_lat_usec从75000到0（官方内核队列文档的写回节流开关），进程等待减少但未稳定；要求结束时恢复75000，不写永久sysfs规则。远端仍有命令等待磁盘，后续须重查实际参数与进程。
- 用户已收到是否允许整机重启的问题；不得将沉默当批准，重启会影响原站点/支付/代理。
- 等批准期间停止知学新增安装任务、关闭知学容器自启；不停止其他项目。不删除原卷或恢复覆盖现有业务。

恢复后：
1. 检查原业务健康、磁盘等待、知学安装进程及容器；读知学实际运行状态，勿重复bootstrap覆盖随机密码。
2. 补齐Linux生产依赖（ignore-scripts，bcrypt预编译可用），使用check-dependencies.mjs验证。
3. 只向隔离的空zhixue库pg_restore备份，核对15/3/130/0，不导入覆盖原业务库。
4. 启动zhixue-api/web并enable；ready核对PostgreSQL/Redis；做合成鉴权测试并按精确ID清理。
5. 建立SSH localhost:18300->VPS127.0.0.1:18180隧道。APP_ORIGIN暂为http://localhost:18300，production Secure Cookie不得关闭；须浏览器验证localhost登录与刷新。
6. 域名确定后才配HTTPS公网入口。AI另行配置。

## 本轮恢复记录

用户已明确允许重启整台VPS并在恢复后继续部署，无需重复征求同一重启许可。已提交systemctl reboot --no-block，SSH命令退出码0。随后新连接从被关闭变成连接超时，尚待核对新uptime，不能将命令成功当作主机已重启完成。另一次systemctl reboot --force --no-wall的SSH在登录前关闭，未证明该命令执行。

重启前最后实查：uptime仍8天，知学DB已healthy、Redis仅Created，API/web inactive，zhixue-install active；runtime.env保持独立且AI关闭。wbt读取0，临时参数收尾命令曾阻塞，重启后必须再核对；未设置任何持久化sysfs规则。原3门公开课/130题备份仍在，尚未恢复到新库。

## 重启后故障定位

已通过新uptime确认整机重启成功。原磁盘参数重启后为75000。约启动11分钟时，可用内存约1.3GB、Swap未使用，但I/O some/full仍约97%/94%；docker.service为activating，containerd.service active，旧站HTTPS返回502。

线程栈实查：containerd PID878/TID1216阻塞在xfs_file_fsync -> file_write_and_wait_range -> folio_wait_writeback，fd4是/var/lib/containerd/io.containerd.metadata.v1.bolt/meta.db。Docker goroutine1在restore的WaitGroup等待，多个恢复任务等待containerd GRPC；未删除/替换该元数据文件。

再次临时写wbt_lat_usec=0的远端bash PID2886进入blk_mq_freeze_queue_wait，磁盘inflight显示0读/1写。其他写回线程进入bio_queue_enter。该参数写入尚未确认完成，不能声称已还原。必须在磁盘恢复或面板重启后再次核对。没有写持久化磁盘参数规则。

当前等待用户提供VPS服务商名称/控制台网址，以检查宿主机/磁盘恢复入口。不索取密码，不自动提交工单。暂停新增知学安装，原应用元数据/卷仍保留；未完成数据恢复，不应交付知学访问地址。

