    function getChat() {
        // SillyTavern 将 chat 暴露在 window 或模块中，我们通过多种方式尝试获取
        if (window.chat) return window.chat;
        return null;
    }

    async function safeDeleteMessage(id) {
        // 方法1：直接调用全局的 deleteMessage
        if (typeof window.deleteMessage === 'function') {
            await window.deleteMessage(id);
            return true;
        }
        // 方法2：通过动态 import 获取
        try {
            const module = await import('../../../../script.js');
            if (module && module.deleteMessage) {
                await module.deleteMessage(id);
                return true;
            }
        } catch(e) {
            console.error("删除失败:", e);
        }
        return false;
    }

    async function getChatArray() {
        // 优先用全局
        if (window.chat && window.chat.length > 0) return window.chat;
        // 备选：动态导入
        try {
            const module = await import('../../../../script.js');
            if (module && module.chat) return module.chat;
        } catch(e) {}
        return null;
    }

    // ================= CSS =================
    const styleHtml = `
    <style>
        .md-click-catcher {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            z-index: 1000; cursor: pointer; border-radius: 10px;
            transition: all 0.2s ease;
        }
        .mes.md-selected .md-click-catcher {
            background: rgba(255, 71, 87, 0.15);
            border: 2px solid #ff4757;
            backdrop-filter: brightness(0.7);
        }
        .mes.md-selected .md-click-catcher::after {
            content: '✓'; position: absolute; right: 15px; top: 15px;
            background: #ff4757; color: white; width: 24px; height: 24px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .md-nuke-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .md-nuke-card {
            background: rgba(255, 71, 87, 0.08); border: 1px solid rgba(255, 71, 87, 0.3);
            border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
        }
        .md-nuke-card:hover { border-color: rgba(255, 71, 87, 0.8); background: rgba(255, 71, 87, 0.15); }
        .md-spare-btn {
            background: #10ac84; color: white; border: none; border-radius: 4px; padding: 4px 8px;
            font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;
        }
        .md-spare-btn:hover { background: #1dd1a1 !important; transform: scale(1.05); }
    </style>`;
    document.head.insertAdjacentHTML('beforeend', styleHtml);

    // ================= 全局引擎 =================
    window.stMultiDeleter = {
        isDeleteMode: false,
        isProcessing: false,
        selectedIds: new Set(),
        lastClickedId: null,

        toggleMode() {
            if (this.isProcessing) return;
            this.isDeleteMode = !this.isDeleteMode;
            const btn = document.getElementById('multi-delete-open-btn');
            
            if (this.isDeleteMode) {
                if(btn) btn.style.color = '#ff4757';
                this.selectedIds.clear();
                this.lastClickedId = null;
                this.showControlPanel();
                this.injectClickCatchers();
            } else {
                if(btn) btn.style.color = '';
                this.hideControlPanel();
                this.removeClickCatchers();
                this.closeModal();
            }
        },

        injectClickCatchers() {
            const self = this;
            document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
                const mesId = el.getAttribute('mesid');
                if (mesId !== null && !el.querySelector('.md-click-catcher')) {
                    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
                    const catcher = document.createElement('div');
                    catcher.className = 'md-click-catcher';
                    catcher.onclick = function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        self.handleBubbleClick(parseInt(mesId), e.shiftKey);
                    };
                    el.appendChild(catcher);
                }
            });
        },

        removeClickCatchers() {
            document.querySelectorAll('.md-click-catcher').forEach(el => el.remove());
            document.querySelectorAll('.mes.md-selected').forEach(el => el.classList.remove('md-selected'));
        },

        handleBubbleClick(id, isShiftPressed) {
            if (isShiftPressed && this.lastClickedId !== null && this.lastClickedId !== id) {
                const start = Math.min(id, this.lastClickedId);
                const end = Math.max(id, this.lastClickedId);
                const isTargetChecked = !this.selectedIds.has(id);
                for (let i = start; i <= end; i++) {
                    if (document.querySelector(`.mes[mesid="${i}"]`)) {
                        if (isTargetChecked) this.selectedIds.add(i);
                        else this.selectedIds.delete(i);
                        this.updateBubbleVisuals(i);
                    }
                }
            } else {
                if (this.selectedIds.has(id)) this.selectedIds.delete(id);
                else this.selectedIds.add(id);
                this.updateBubbleVisuals(id);
            }
            this.lastClickedId = id;
            this.updatePanelCount();
        },

        updateBubbleVisuals(id) {
            const bubble = document.querySelector(`.mes[mesid="${id}"]`);
            if (!bubble) return;
            if (this.selectedIds.has(id)) bubble.classList.add('md-selected');
            else bubble.classList.remove('md-selected');
        },

        showControlPanel() {
            if (!document.getElementById('multi-delete-panel')) {
                const html = `
                <div id="multi-delete-panel" style="position: fixed; bottom: 20px; left: 10px; right: 10px; margin: 0 auto; max-width: 600px; z-index: 2147483647; background: rgba(20,20,20,0.95); backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid #555; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        <span id="multi-delete-count" style="font-weight: bold; color: white; font-size: 14px; white-space: nowrap;">已选 0 条</span>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 100px; background: rgba(0,0,0,0.6); border: 1px solid #777; color: white; border-radius: 4px; padding: 5px 8px; font-size: 13px; outline: none;">
                            <div class="menu_button interactable" style="background: #8e44ad; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 13px;" onclick="window.stMultiDeleter.selectByRange()">范围选中</div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
                        <div class="menu_button interactable" style="background: #3498db; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;" onclick="window.stMultiDeleter.selectAll()">全选</div>
                        <div class="menu_button interactable" style="background: #16a085; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;" onclick="window.stMultiDeleter.invertSelect()">反选</div>
                        <div class="menu_button interactable" style="background: #e67e22; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;" onclick="window.stMultiDeleter.selectDownward()">向下全选</div>
                        <div class="menu_button interactable" style="background: #ff4757; color: white; border: none; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 12px;" onclick="window.stMultiDeleter.showReviewModal()"><i class="fa-solid fa-trash"></i> 删除</div>
                        <div class="menu_button interactable" style="background: #747d8c; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px;" onclick="window.stMultiDeleter.toggleMode()">取消</div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', html);
            }
            document.getElementById('multi-delete-panel').style.display = 'flex';
            this.updatePanelCount();
        },

        hideControlPanel() {
            const p = document.getElementById('multi-delete-panel');
            if(p) p.style.display = 'none';
        },

        updatePanelCount() {
            const el = document.getElementById('multi-delete-count');
            if(el) el.innerText = `已选 ${this.selectedIds.size} 条`;
        },

        selectAll() {
            document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
                const id = parseInt(el.getAttribute('mesid'));
                if(!isNaN(id)) { this.selectedIds.add(id); this.updateBubbleVisuals(id); }
            });
            this.updatePanelCount();
        },

        invertSelect() {
            document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
                const id = parseInt(el.getAttribute('mesid'));
                if(!isNaN(id)) {
                    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
                    else this.selectedIds.add(id);
                    this.updateBubbleVisuals(id);
                }
            });
            this.updatePanelCount();
        },

        selectDownward() {
            if (this.selectedIds.size === 0) return toastr.warning("请先点击选择一个起始楼层 o-o");
            const startId = Math.min(...Array.from(this.selectedIds));
            document.querySelectorAll('#chat .mes[mesid]').forEach(el => {
                const id = parseInt(el.getAttribute('mesid'));
                if(!isNaN(id) && id >= startId) {
                    this.selectedIds.add(id);
                    this.updateBubbleVisuals(id);
                }
            });
            this.updatePanelCount();
            toastr.success(`已向下全选 #${startId} 之后的所有楼层 ovo`);
        },

        selectByRange() {
            const val = document.getElementById('md-range-input').value.trim();
            if (!val) return toastr.warning("请输入想要选中的楼层，例如: 0-12");
            let addedCount = 0;
            val.split(',').forEach(part => {
                const range = part.trim().split('-');
                if (range.length === 1) {
                    const id = parseInt(range[0]);
                    if (!isNaN(id) && document.querySelector(`.mes[mesid="${id}"]`)) {
                        this.selectedIds.add(id); this.updateBubbleVisuals(id); addedCount++;
                    }
                } else if (range.length === 2) {
                    const start = parseInt(range[0]), end = parseInt(range[1]);
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                            if (document.querySelector(`.mes[mesid="${i}"]`)) {
                                this.selectedIds.add(i); this.updateBubbleVisuals(i); addedCount++;
                            }
                        }
                    }
                }
            });
            this.updatePanelCount();
            if (addedCount > 0) { toastr.success("选中成功 ovo"); document.getElementById('md-range-input').value = ''; }
            else toastr.error("格式错误或无对应楼层");
        },

        showReviewModal() {
            if (this.selectedIds.size === 0) return toastr.warning("未选择任何消息 o^o", "提示");
            this.closeModal();
            
            let userCount = 0, charCount = 0, sysCount = 0;
            const sortedIds = Array.from(this.selectedIds).sort((a, b) => a - b);
            let cardsHtml = '';
            
            sortedIds.forEach(id => {
                const bubble = document.querySelector(`.mes[mesid="${id}"]`);
                if (!bubble) return;
                
                let typeLabel = "角色";
                const isUser = bubble.getAttribute('is_user') === 'true';
                const isSystem = bubble.getAttribute('is_system') === 'true';
                
                if (isUser) { userCount++; typeLabel = "用户"; }
                else if (isSystem) { sysCount++; typeLabel = "系统"; }
                else { charCount++; }
                
                let name = bubble.getAttribute('ch_name') || (isUser ? "You" : "Character");
                const mesText = bubble.querySelector('.mes_text');
                let textPreview = mesText ? mesText.textContent.replace(/\s+/g, ' ').trim().substring(0, 150) : "（空消息/图片）";
                if (!textPreview) textPreview = "（空消息/图片）";
                
                cardsHtml += `
                <div class="md-nuke-card" id="md-card-${id}">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 6px;">
                        <div style="display:flex; align-items:center;">
                            <span style="font-weight: bold; color: #ff6b81; font-size: 13px;">#${id}</span>
                            <span style="font-size: 12px; color: #ccc; margin-left: 8px;">[${typeLabel}] ${name}</span>
                        </div>
                        <div class="md-spare-btn" onclick="window.stMultiDeleter.spareCard(${id})">
                            <i class="fa-solid fa-rotate-left"></i> 撤出
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #ddd; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${textPreview}</div>
                </div>`;
            });

            const modalHtml = `
            <div id="md-review-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); padding: 10px;">
                <div style="background: #222; width: 100%; max-width: 700px; height: 85vh; border-radius: 12px; border: 1px solid #555; display: flex; flex-direction: column; overflow: hidden;">
                    <div style="flex-shrink: 0; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; font-size: 18px; display:flex; justify-content: space-between; align-items: center;">
                        <span><i class="fa-solid fa-trash-can-arrow-up"></i> 处理队列确认</span>
                        <span style="font-size:14px; font-weight:normal; color:#ff6b81;" id="md-queue-total">共 ${this.selectedIds.size} 条</span>
                    </div>
                    <div style="flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 15px; background: rgba(0,0,0,0.2);">
                        <div style="display: flex; gap: 15px; font-size: 13px; color: #aaa; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-wrap: wrap;">
                            <div>用户 <span style="color:#fff;font-weight:bold;">${userCount}</span></div>
                            <div>角色 <span style="color:#fff;font-weight:bold;">${charCount}</span></div>
                            <div>系统 <span style="color:#fff;font-weight:bold;">${sysCount}</span></div>
                        </div>
                        <div class="md-nuke-grid">${cardsHtml}</div>
                    </div>
                    <div style="flex-shrink: 0; padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;">
                        <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#f39c12;">
                            <input type="checkbox" id="md-export-backup" style="accent-color:#f39c12; width:16px; height:16px;"> 
                            <i class="fa-solid fa-file-export"></i> 下载TXT备份
                        </label>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <div class="menu_button interactable" style="background: #747d8c; padding: 6px 12px;" onclick="window.stMultiDeleter.closeModal()">返回</div>
                            <div class="menu_button interactable" style="background: #8e44ad; color: white; padding: 6px 12px; font-weight:bold;" onclick="window.stMultiDeleter.executeDelete(true)"><i class="fa-solid fa-truck-fast"></i> 搬家</div>
                            <div class="menu_button interactable" style="background: #ff4757; font-weight:bold; padding: 6px 12px;" onclick="window.stMultiDeleter.executeDelete(false)">确认删除</div>
                        </div>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        },

        spareCard(id) {
            this.selectedIds.delete(id);
            this.updateBubbleVisuals(id);
            this.updatePanelCount();
            const card = document.getElementById(`md-card-${id}`);
            if(card) {
                card.style.transform = 'scale(0.8)';
                card.style.opacity = '0';
                setTimeout(() => {
                    card.remove();
                    const t = document.getElementById('md-queue-total');
                    if(t) t.innerText = `共 ${this.selectedIds.size} 条`;
                    if(this.selectedIds.size === 0) { this.closeModal(); toastr.info("队列已清空 ovo"); }
                }, 200);
            }
        },

        closeModal() {
            const m = document.getElementById('md-review-modal');
            if(m) m.remove();
        },

        generateTXTBackup(idsToNuke) {
            getChatArray().then(chatArr => {
                if(!chatArr) return;
                let content = "=== SillyTavern Deleted Messages Backup ===\nDate: " + new Date().toLocaleString() + "\n\n";
                idsToNuke.forEach(id => {
                    const msg = chatArr[id];
                    if(msg) content += `[#${id}] ${msg.name || "Unknown"}:\n${msg.mes}\n\n---\n\n`;
                });
                const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `ST_Backup_${Date.now()}.txt`; a.click();
            });
        },

        generateChatFileForMove(idsToMove) {
            getChatArray().then(chatArr => {
                if(!chatArr) return;
                let userName = "User", charName = "Character";
                for (let i = 0; i < chatArr.length; i++) {
                    if (chatArr[i].is_user) userName = chatArr[i].name || userName;
                    if (!chatArr[i].is_user && !chatArr[i].is_system) charName = chatArr[i].name || charName;
                }
                let jsonl = JSON.stringify({ user_name: userName, character_name: charName, create_date: Date.now(), chat_metadata: {} }) + "\n";
                idsToMove.sort((a,b) => a - b).forEach(id => { if(chatArr[id]) jsonl += JSON.stringify(chatArr[id]) + "\n"; });
                const blob = new Blob([jsonl], { type: "application/json" });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `搬出聊天_${charName}_${Date.now()}.jsonl`; a.click();
            });
        },

        async executeDelete(isMove) {
            if (this.selectedIds.size === 0) return this.closeModal();
            let finalIds = Array.from(this.selectedIds);
            this.isProcessing = true;

            if (isMove) this.generateChatFileForMove([...finalIds]);
            const backupEl = document.getElementById('md-export-backup');
            if (backupEl && backupEl.checked) this.generateTXTBackup([...finalIds]);

            finalIds.sort((a, b) => b - a);
            let successCount = 0;

            for (const id of finalIds) {
                const ok = await safeDeleteMessage(id);
                if (ok) successCount++;
            }

            if (successCount > 0) {
                if (isMove) toastr.success(`成功搬走 ${successCount} 条信息 ovo`, "搬家完成", {timeOut: 8000});
                else toastr.success(`成功删除${successCount}条信息 ovo`);
            }
            
            this.isProcessing = false;
            this.closeModal();
            this.toggleMode();
        }
    };

    // ================= 入口注入 =================
    const checkBtn = setInterval(() => {
        const bar = document.getElementById('extensionsMenu');
        if (bar && !document.getElementById('multi-delete-open-btn')) {
            const btn = document.createElement('div');
            btn.id = 'multi-delete-open-btn';
            btn.className = 'list-group-item flex-container flex-gap-10 interactable';
            btn.innerHTML = '<div class="fa-solid fa-list-check"></div><div>批量删除信息</div>';
            btn.onclick = () => window.stMultiDeleter.toggleMode();
            bar.appendChild(btn);
            clearInterval(checkBtn);
            console.log(extensionName + ' 加载完成 ovo');
        }
    }, 2000);
})();
