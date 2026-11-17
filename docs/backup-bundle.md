# 数据库与媒体联合备份

`npm run backup:bundle -- create <数据库容器ID> <已停止API容器ID> <数据库用户> <库名> <新的绝对目录>`

工具不读取.env、不停止服务、不覆盖已有目录。运维人员必须先进入维护窗口，停止所有API实例、后台任务及其他数据库/媒体写入者，再执行备份；脚本仅能检查指定API已退出，不能发现其他写入者。完成后由运维人员恢复服务。

输出含database.dump、media目录和SHA-256清单manifest.json。失败目录不应当作可用备份；必须有完成清单并通过 `npm run backup:bundle -- verify <目录>`。校验会拒绝丢失、增加、修改的文件和符号链接；清单用于检测损坏，不是签名，不能抵抗攻击者同时修改文件和清单。

备份包含用户资料和媒体，必须放到受限、加密存储并另存异机。工具不复制.env、密钥、Redis、证书或源码；部署版本、独立密钥托管和恢复所需配置须另外维护。当前不自动定时、不自动清理旧备份，不等于灾备已经上线。

## 恢复流程

1. 校验备份，将应用置于维护状态。使用与备份兼容的PostgreSQL版本、相同应用版本及独立恢复环境。
2. 创建新的空数据库（template0），使用pg_restore --exit-on-error --single-transaction恢复database.dump；禁止直接覆盖现有库。
3. 把media复制到新的媒体卷，设置API运行用户的读写权限；不要合并到旧卷，否则可能残留不属于备份的文件。
4. 在独立环境核对数据库记录、媒体引用和视频读取，重新做登录/权限检查。确认之后才安排正式切换；保留旧库和旧媒体以便回退。

自动验收 `npm run verify:containers` 使用随机凭据与合成账号，实际调用联合备份工具，验证运行中拒绝备份、文件损坏检测、数据库临时库恢复和媒体独立目录恢复。它不会替用户覆盖真实数据库，不包含真实视频播放或全量大文件性能验收。

参考：[PostgreSQL备份与恢复](https://www.postgresql.org/docs/17/backup-dump.html)、[Docker文件复制](https://docs.docker.com/reference/cli/docker/container/cp/)。
