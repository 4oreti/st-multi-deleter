// ==================== 终极原生JS调试版 ====================
// 使用IIFE（立即调用函数表达式）包裹，这是最稳定、兼容性最好的经典写法
(function () {
    const extensionName = 'ST-Multi-Deleter';

    // ================= 1. 暴力注入CSS样式 =================
    // 创建一个style标签，把CSS塞进去，然后插入到head中
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
        .md-click-catcher {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            z-index: 1000; cursor: pointer; border-radius: 10px;
            transition: all 0.2s ease;
        }
        .mes.md-selected .md-click-catcher {
            background: rgba(255, 71, 87, 0.15); border: 2px solid #ff4757;
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
        .md-spare-btn {
            background: #10ac84; color: white; border: none; border-radius: 4px; padding: 4px 8px;
            font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;
        }
    `;
    document.head.appendChild(styleElement);

    // ================= 2. 挂载全局核心引擎 =================
    window.stMultiDeleter = {
        isDeleteMode: false,
        isProcessing: false,
        selectedIds: new Set(),
        lastClickedId: null,

        toggleMode() {
            // ★ 调试探针 1 ★
            alert("探针1：入口按钮被点击！即将切换模式...");
            
            if (this.isProcessing) return;
            this.isDeleteMode = !this.isDeleteMode;
            const btn = document.getElementById('multi-delete-open-btn');
            
            if (this.isDeleteMode) {
                if(btn) btn.classList.add('success');
                this.selectedIds.clear();
                this.lastClickedId = null;
                this.showControlPanel();
                this.injectClickCatchers();
            } else {
                if(btn) btn.classList.remove('success');
                this.hideControlPanel();
                this.removeClickCatchers();
                this.closeModal();
            }
        },

        injectClickCatchers() {
            document.querySelectorAll('.mes[mesid]').forEach(el => {
                if (el.querySelector('.md-click-catcher')) return;
                if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
                
                const catcher = document.createElement('div');
                catcher.className = 'md-click-catcher';
                const mesId = el.getAttribute('mesid');
                catcher.setAttribute('data-mesid', mesId);
                catcher.onclick = (e) => {
                    e.stopPropagation();
                    this.handleBubbleClick(parseInt(mesId), e.shiftKey);
                };
                el.appendChild(catcher);
            });
        },

        removeClickCatchers() {
            document.querySelectorAll('.md-click-catcher').forEach(el => el.remove());
            document.querySelectorAll('.mes.md-selected').forEach(el => el.classList.remove('md-selected'));
        },

        handleBubbleClick(id, isShiftPressed) {
            if (isShiftPressed && this.lastClickedId !== null && this.lastClickedId !== id) {
                const start = Math.min(id, this.lastClickedId), end = Math.max(id, this.lastClickedId);
                const isTargetChecked = !this.selectedIds.has(id); 
                for (let i = start; i <= end; i++) {
                    if (document.querySelector(`.mes[mesid="${i}"]`)) {
                        if (isTargetChecked) this.selectedIds.add(i); else this.selectedIds.delete(i);
                        this.updateBubbleVisuals(i);
                    }
                }
            } else {
                if (this.selectedIds.has(id)) this.selectedIds.delete(id); else this.selectedIds.add(id);
                this.updateBubbleVisuals(id);
            }
            this.lastClickedId = id;
            this.updatePanelCount();
        },

        updateBubbleVisuals(id) {
            const bubble = document.querySelector(`.mes[mesid="${id}"]`);
            if (bubble) bubble.classList.toggle('md-selected', this.selectedIds.has(id));
        },

        showControlPanel() {
            // ★ 调试探针 2 ★
            alert("探针2：开始显示控制面板！");
            
            if (document.getElementById('multi-delete-panel')) {
                document.getElementById('multi-delete-panel').style.display = 'flex';
                return;
            }
            
            const panel = document.createElement('div');
            panel.id = 'multi-delete-panel';
            // 使用内联样式，确保手机端绝对居中
            panel.style.cssText = 'position: fixed; bottom: 20px; left: 10px; right: 10px; margin: 0 auto; max-width: 600px; z-index: 2147483647; background: rgba(20,20,20,0.95); backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid #555; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);';
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    <span id="multi-delete-count" style="font-weight: bold; color: white; font-size: 14px; white-space: nowrap;">已选 0 条</span>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 100px; background: rgba(0,0,0,0.6); border: 1px solid #777; color: white; border-radius: 4px; padding: 5px 8px; font-size: 13px; outline: none;">
                        <button class="menu_button interactable" style="background: #8e44ad; color: white; padding: 5px 10px;" onclick="window.stMultiDeleter.selectByRange()">范围选中</button>
                    </div>
                </div>
                <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
                    <button class="menu_button interactable" style="background: #3498db; color: white;" onclick="window.stMultiDeleter.selectAll()">全选</button>
                    <button class="menu_button interactable" style="background: #16a085; color: white;" onclick="window.stMultiDeleter.invertSelect()">反选</button>
                    <button class="menu_button interactable" style="background: #e67e22; color: white;" onclick="window.stMultiDeleter.selectDownward()">向下全选</button>
                    <button class="menu_button interactable" style="background: #ff4757; color: white; font-weight: bold;" onclick="window.stMultiDeleter.showReviewModal()"><i class="fa-solid fa-trash"></i> 删除</button>
                    <button class="menu_button interactable" style="background: #747d8c; color: white;" onclick="window.stMultiDeleter.toggleMode()">取消</button>
                </div>
            `;
            document.body.appendChild(panel);
            this.updatePanelCount();
        },

        hideControlPanel() {
            const panel = document.getElementById('multi-delete-panel');
            if(panel) panel.style.display = 'none';
        },
        
        updatePanelCount() {
            const el = document.getElementById('multi-delete-count');
            if(el) el.innerText = `已选 ${this.selectedIds.size} 条`;
        },

        selectAll() {
            document.querySelectorAll('.mes[mesid]').forEach(el => {
                const id = parseInt(el.getAttribute('mesid'));
                if(!isNaN(id)) { this.selectedIds.add(id); this.updateBubbleVisuals(id); }
            });
            this.updatePanelCount();
        },

        invertSelect() {
            document.querySelectorAll('.mes[mesid]').forEach(el => {
                const id = parseInt(el.getAttribute('mesid'));
                if(!isNaN(id)) {
                    if (this.selectedIds.has(id)) this.selectedIds.delete(id); else this.selectedIds.add(id);
                    this.updateBubbleVisuals(id);
                }
            });
            this.updatePanelCount();
        },
        
        // ... (其他如 selectDownward, selectByRange, showReviewModal, spareCard, closeModal, generateTXTBackup, generateChatFileForMove, executeDelete 逻辑与上一版基本相同，这里不再赘述，但已全部改写为纯JS)
        // ...篇幅原因省略，但以下是完整的纯JS版本，你可以直接复制替换整个stMultiDeleter对象
        selectDownward() {
            if (this.selectedIds.size === 0) return toastr.warning("请先点击选择一个起始楼层 o-o");
            const startId = Math.min(...Array.from(this.selectedIds));
            document.querySelectorAll('.mes[mesid]').forEach(el => {
                const id = parseInt(el.getAttribute('mesid'));
                if (!isNaN(id) && id >= startId) {
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
            if (addedCount > 0) { toastr.success("选中成功 ovo"); document.getElementById('md-range-input').value = ''; } else toastr.error("格式错误或无对应楼层");
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
                if (isUser) { userCount++; typeLabel = "用户"; } else if (isSystem) { sysCount++; typeLabel = "系统"; } else { charCount++; }
                let name = (bubble.getAttribute('ch_name') || '').trim() || (isUser ? "You" : "Character");
                let textPreview = (bubble.querySelector('.mes_text').textContent || '').replace(/\n/g, ' ').trim().substring(0, 150) || "（空消息/图片）";
                cardsHtml += `<div class="md-nuke-card" id="md-card-${id}"><div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 6px;"><div style="display:flex; align-items:center;"><span style="font-weight: bold; color: #ff6b81; font-size: 13px;">#${id}</span><span style="font-size: 12px; color: #ccc; margin-left: 8px;">[${typeLabel}] ${name}</span></div><button class="md-spare-btn" onclick="window.stMultiDeleter.spareCard(${id})"><i class="fa-solid fa-rotate-left"></i> 撤出</button></div><div style="font-size: 13px; color: #ddd; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${textPreview}</div></div>`;
            });
            const modal = document.createElement('div');
            modal.id = 'md-review-modal';
            modal.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); padding: 10px;`;
            modal.innerHTML = `<div style="background: #222; width: 100%; max-width: 700px; height: 85vh; border-radius: 12px; border: 1px solid #555; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);"><div style="flex-shrink: 0; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; font-size: 18px; display:flex; justify-content: space-between; align-items: center;"><span><i class="fa-solid fa-trash-can-arrow-up"></i> 处理队列确认</span><span style="font-size:14px; font-weight:normal; color:#ff6b81;" id="md-queue-total">共 ${this.selectedIds.size} 条</span></div><div style="flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 15px; background: rgba(0,0,0,0.2);"><div style="display: flex; gap: 15px; font-size: 13px; color: #aaa; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-wrap: wrap;"><div>包含：用户发言 <span style="color:#fff;font-weight:bold;">${userCount}</span> 条</div><div>角色发言 <span style="color:#fff;font-weight:bold;">${charCount}</span> 条</div><div>系统提示 <span style="color:#fff;font-weight:bold;">${sysCount}</span> 条</div></div><div class="md-nuke-grid">${cardsHtml}</div></div><div style="flex-shrink: 0; padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;"><label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#f39c12;"><input type="checkbox" id="md-export-backup" style="accent-color:#f39c12; width:16px; height:16px; cursor:pointer;"> <i class="fa-solid fa-file-export"></i> 删除前下载TXT备份</label><div style="display:flex; gap:10px; flex-wrap:wrap; justify-content: flex-end;"><button class="menu_button interactable" style="background: #747d8c;" onclick="window.stMultiDeleter.closeModal()">返回</button><button class="menu_button interactable" style="background: #8e44ad; color: white;" title="打包成.jsonl文件并移除" onclick="window.stMultiDeleter.executeDelete(true)"><i class="fa-solid fa-truck-fast"></i> 搬家</button><button class="menu_button interactable" style="background: #ff4757; font-weight:bold;" onclick="window.stMultiDeleter.executeDelete(false)">确认删除</button></div></div></div>`;
            document.body.appendChild(modal);
        },
        spareCard(id) {
            this.selectedIds.delete(id);
            this.updateBubbleVisuals(id);
            this.updatePanelCount();
            const card = document.getElementById(`md-card-${id}`);
            if (card) { card.style.transform = 'scale(0.8)'; card.style.opacity = '0'; setTimeout(() => { card.remove(); const totalEl = document.getElementById('md-queue-total'); if (totalEl) totalEl.innerText = `共 ${this.selectedIds.size} 条`; if (this.selectedIds.size === 0) { this.closeModal(); toastr.info("队列已清空 ovo"); } }, 200); }
        },
        closeModal() { const modal = document.getElementById('md-review-modal'); if (modal) modal.remove(); },
        generateTXTBackup(idsToNuke) {
            try { let content = `=== SillyTavern Deleted Messages Backup ===\nDate: ${new Date().toLocaleString()}\n\n`; idsToNuke.slice().reverse().forEach(id => { const msg = window.chat[id]; if (msg) { content += `[ID: ${id}] ${msg.name || (msg.is_user ? "You" : "Character")}:\n${msg.mes}\n\n------------------------\n\n`; } }); const blob = new Blob([content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `ST_Deleted_Backup_${new Date().getTime()}.txt`; a.click(); URL.revokeObjectURL(url); } catch (e) {}
        },
        generateChatFileForMove(idsToMove) {
            try { let userName = "User", charName = "Character"; for (let i = 0; i < window.chat.length; i++) { if (window.chat[i].is_user) userName = window.chat[i].name || userName; if (!window.chat[i].is_user && !window.chat[i].is_system) charName = window.chat[i].name || charName; } let jsonlContent = `${JSON.stringify({ user_name: userName, character_name: charName, create_date: Date.now(), chat_metadata: {} })}\n`; idsToMove.slice().sort((a, b) => a - b).forEach(id => { if (window.chat[id]) jsonlContent += `${JSON.stringify(window.chat[id])}\n`; }); const blob = new Blob([jsonlContent], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `搬出聊天_${charName}_${new Date().getTime()}.jsonl`; a.click(); URL.revokeObjectURL(url); } catch (e) {}
        },
        async executeDelete(isMove = false) {
            if (this.selectedIds.size === 0) return this.closeModal();
            let finalIds = Array.from(this.selectedIds);
            this.isProcessing = true;
            const moveBtn = document.getElementById('md-modal-move'), confirmBtn = document.getElementById('md-modal-confirm');
            if (isMove) { if (moveBtn) moveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; this.generateChatFileForMove(finalIds); } else { if (confirmBtn) confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
            if (document.getElementById('md-export-backup').checked) this.generateTXTBackup(finalIds);
            finalIds.sort((a, b) => b - a);
            let successCount = 0;
            for (const id of finalIds) { if (id < window.chat.length) { await window.deleteMessage(id); successCount++; } }
            if (successCount > 0) { if (isMove) toastr.success(`成功搬走 ${successCount} 条信息！请使用酒馆的【导入聊天】功能 ovo`, "搬家完成 ovo", { timeOut: 8000 }); else toastr.success(`成功删除${successCount}条信息 ovo`); }
            this.isProcessing = false; this.closeModal(); this.toggleMode();
        }
    };

    // ================= 3. 插件注入入口 =================
    const checkInterval = setInterval(() => {
        // 等待酒馆原生变量和菜单都加载完毕再注入
        const bar = document.getElementById('extensionsMenu');
        if (bar && window.chat && typeof window.deleteMessage === 'function') {
            clearInterval(checkInterval);
            
            // ★ 调试探针 3 ★
            alert("探针3：酒馆加载完毕，准备注入按钮！");

            const btn = document.createElement('div');
            btn.id = 'multi-delete-open-btn';
            btn.className = 'list-group-item flex-container flex-gap-10 interactable';
            btn.innerHTML = '<div class="fa-solid fa-list-check"></div><div>批量删除信息</div>'; 
            
            // 绑定入口点击事件
            btn.onclick = () => window.stMultiDeleter.toggleMode();
            
            bar.appendChild(btn);
            console.log(`${extensionName} 原生调试版加载完成 ovo`);
        }
    }, 500);

})();
