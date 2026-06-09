// 使用IIFE（立即调用函数表达式）包裹，避免污染全局，这是最标准的“老式脚本”写法
(function () {
    const extensionName = 'ST-Multi-Deleter';

    // ================= CSS 样式注入 =================
    // 这部分保持不变，因为它工作得很好
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

    // ================= 全局核心引擎 =================
    // 像“备份助手”一样，把所有功能都挂载到 window 对象的一个属性上
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
            $('.mes').each((index, el) => {
                const mesId = $(el).attr('mesid');
                if (mesId !== undefined && $(el).find('.md-click-catcher').length === 0) {
                    if ($(el).css('position') === 'static') $(el).css('position', 'relative');
                    
                    const catcher = document.createElement('div');
                    catcher.className = 'md-click-catcher';
                    catcher.setAttribute('data-mesid', mesId);
                    catcher.onclick = (e) => {
                        e.stopPropagation();
                        this.handleBubbleClick(parseInt(mesId), e.shiftKey);
                    };
                    $(el).append(catcher);
                }
            });
        },

        removeClickCatchers() {
            $('.md-click-catcher').remove();
            $('.mes').removeClass('md-selected');
        },

        handleBubbleClick(id, isShiftPressed) {
            if (isShiftPressed && this.lastClickedId !== null && this.lastClickedId !== id) {
                const start = Math.min(id, this.lastClickedId);
                const end = Math.max(id, this.lastClickedId);
                const isTargetChecked = !this.selectedIds.has(id); 
                for (let i = start; i <= end; i++) {
                    if ($(`.mes[mesid="${i}"]`).length > 0) {
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
            const bubble = $(`.mes[mesid="${id}"]`);
            if (this.selectedIds.has(id)) bubble.addClass('md-selected');
            else bubble.removeClass('md-selected');
        },

        showControlPanel() {
            if (!document.getElementById('multi-delete-panel')) {
                const html = `
                <div id="multi-delete-panel" style="position: fixed; bottom: 20px; left: 10px; right: 10px; margin: 0 auto; max-width: 600px; z-index: 2147483647; background: rgba(20,20,20,0.95); backdrop-filter: blur(10px); border-radius: 12px; border: 1px solid #555; padding: 12px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                        <span id="multi-delete-count" style="font-weight: bold; color: white; font-size: 14px; white-space: nowrap;">已选 0 条</span>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <input type="text" id="md-range-input" placeholder="如:0-12" style="width: 100px; background: rgba(0,0,0,0.6); border: 1px solid #777; color: white; border-radius: 4px; padding: 5px 8px; font-size: 13px; outline: none;">
                            <button class="menu_button interactable" style="background: #8e44ad; color: white; border: none; padding: 5px 10px; border-radius: 5px; font-size: 13px; cursor:pointer;" onclick="window.stMultiDeleter.selectByRange()">范围选中</button>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px;">
                        <button class="menu_button interactable" style="background: #3498db; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px; cursor:pointer;" onclick="window.stMultiDeleter.selectAll()">全选</button>
                        <button class="menu_button interactable" style="background: #16a085; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px; cursor:pointer;" onclick="window.stMultiDeleter.invertSelect()">反选</button>
                        <button class="menu_button interactable" style="background: #e67e22; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px; cursor:pointer;" onclick="window.stMultiDeleter.selectDownward()">向下全选</button>
                        <button class="menu_button interactable" style="background: #ff4757; color: white; border: none; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 12px; cursor:pointer;" onclick="window.stMultiDeleter.showReviewModal()"><i class="fa-solid fa-trash"></i> 删除</button>
                        <button class="menu_button interactable" style="background: #747d8c; color: white; border: none; padding: 6px 10px; border-radius: 5px; font-size: 12px; cursor:pointer;" onclick="window.stMultiDeleter.toggleMode()">取消</button>
                    </div>
                </div>`;
                $('body').append(html);
            }
            $('#multi-delete-panel').show();
            this.updatePanelCount();
        },

        hideControlPanel() { $('#multi-delete-panel').hide(); },
        updatePanelCount() { $('#multi-delete-count').text(`已选 ${this.selectedIds.size} 条`); },

        selectAll() {
            $('.mes[mesid]').each((i, el) => {
                const id = parseInt($(el).attr('mesid'));
                if(!isNaN(id)) { this.selectedIds.add(id); this.updateBubbleVisuals(id); }
            });
            this.updatePanelCount();
        },

        invertSelect() {
            $('.mes[mesid]').each((i, el) => {
                const id = parseInt($(el).attr('mesid'));
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
            $('.mes[mesid]').each((i, el) => {
                const id = parseInt($(el).attr('mesid'));
                if(!isNaN(id) && id >= startId) {
                    this.selectedIds.add(id);
                    this.updateBubbleVisuals(id);
                }
            });
            this.updatePanelCount();
            toastr.success(`已向下全选 #${startId} 之后的所有楼层 ovo`);
        },

        selectByRange() {
            const val = $('#md-range-input').val().trim();
            if (!val) return toastr.warning("请输入想要选中的楼层，例如: 0-12");
            let addedCount = 0;
            val.split(',').forEach(part => {
                const range = part.trim().split('-');
                if (range.length === 1) { 
                    const id = parseInt(range[0]);
                    if (!isNaN(id) && $(`.mes[mesid="${id}"]`).length > 0) {
                        this.selectedIds.add(id); this.updateBubbleVisuals(id); addedCount++;
                    }
                } else if (range.length === 2) { 
                    const start = parseInt(range[0]), end = parseInt(range[1]);
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                            if ($(`.mes[mesid="${i}"]`).length > 0) {
                                this.selectedIds.add(i); this.updateBubbleVisuals(i); addedCount++;
                            }
                        }
                    }
                }
            });
            this.updatePanelCount();
            if (addedCount > 0) { toastr.success("选中成功 ovo"); $('#md-range-input').val(''); } 
            else toastr.error("格式错误或无对应楼层");
        },

        showReviewModal() {
            if (this.selectedIds.size === 0) return toastr.warning("未选择任何消息 o^o", "提示");
            this.closeModal();
            
            let userCount = 0, charCount = 0, sysCount = 0;
            const sortedIds = Array.from(this.selectedIds).sort((a, b) => a - b);
            let cardsHtml = '';
            
            sortedIds.forEach(id => {
                const bubble = $(`.mes[mesid="${id}"]`);
                if (bubble.length === 0) return; 
                
                let typeLabel = "角色";
                const isUser = bubble.attr('is_user') === 'true';
                const isSystem = bubble.attr('is_system') === 'true';
                
                if (isUser) { userCount++; typeLabel = "用户"; }
                else if (isSystem) { sysCount++; typeLabel = "系统"; }
                else { charCount++; }
                
                let rawName = bubble.attr('ch_name');
                let name = rawName ? rawName.trim() : (isUser ? "You" : "Character");
                let textPreview = bubble.find('.mes_text').text().replace(/\n/g, ' ').trim().substring(0, 150);
                if (!textPreview) textPreview = "（空消息/图片）";
                
                cardsHtml += `
                <div class="md-nuke-card" id="md-card-${id}">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.2); padding-bottom: 6px;">
                        <div style="display:flex; align-items:center;">
                            <span style="font-weight: bold; color: #ff6b81; font-size: 13px;">#${id}</span>
                            <span style="font-size: 12px; color: #ccc; margin-left: 8px;">[${typeLabel}] ${name}</span>
                        </div>
                        <button class="md-spare-btn" onclick="window.stMultiDeleter.spareCard(${id})">
                            <i class="fa-solid fa-rotate-left"></i> 撤出
                        </button>
                    </div>
                    <div style="font-size: 13px; color: #ddd; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${textPreview}</div>
                </div>`;
            });

            const modalHtml = `
            <div id="md-review-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 2147483647; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); padding: 10px;">
                <div style="background: #222; width: 100%; max-width: 700px; height: 85vh; border-radius: 12px; border: 1px solid #555; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.6);">
                    <div style="flex-shrink: 0; padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: bold; font-size: 18px; display:flex; justify-content: space-between; align-items: center;">
                        <span><i class="fa-solid fa-trash-can-arrow-up"></i> 处理队列确认</span>
                        <span style="font-size:14px; font-weight:normal; color:#ff6b81;" id="md-queue-total">共 ${this.selectedIds.size} 条</span>
                    </div>
                    <div style="flex: 1 1 auto; overflow-y: auto; min-height: 0; padding: 15px; background: rgba(0,0,0,0.2);">
                        <div style="display: flex; gap: 15px; font-size: 13px; color: #aaa; margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-wrap: wrap;">
                            <div>包含：用户发言 <span style="color:#fff;font-weight:bold;">${userCount}</span> 条</div>
                            <div>角色发言 <span style="color:#fff;font-weight:bold;">${charCount}</span> 条</div>
                            <div>系统提示 <span style="color:#fff;font-weight:bold;">${sysCount}</span> 条</div>
                        </div>
                        <div class="md-nuke-grid">${cardsHtml}</div>
                    </div>
                    <div style="flex-shrink: 0; padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;">
                        <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:13px; color:#f39c12;">
                            <input type="checkbox" id="md-export-backup" style="accent-color:#f39c12; width:16px; height:16px; cursor:pointer;"> 
                            <i class="fa-solid fa-file-export"></i> 删除前下载TXT备份
                        </label>
                        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content: flex-end;">
                            <button class="menu_button interactable" style="background: #747d8c; padding: 6px 12px; cursor:pointer;" onclick="window.stMultiDeleter.closeModal()">返回</button>
                            <button id="md-modal-move" class="menu_button interactable" style="background: #8e44ad; color: white; border: none; border-radius: 5px; padding: 6px 12px; font-weight:bold; cursor:pointer;" title="打包成.jsonl文件并移除" onclick="window.stMultiDeleter.executeDelete(true)">
                                <i class="fa-solid fa-truck-fast"></i> 搬家
                            </button>
                            <button id="md-modal-confirm" class="menu_button interactable" style="background: #ff4757; font-weight:bold; padding: 6px 12px; cursor:pointer;" onclick="window.stMultiDeleter.executeDelete(false)">确认删除</button>
                        </div>
                    </div>
                </div>
            </div>`;
            $('body').append(modalHtml);
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
                    const totalEl = document.getElementById('md-queue-total');
                    if(totalEl) totalEl.innerText = `共 ${this.selectedIds.size} 条`;
                    if(this.selectedIds.size === 0) {
                        this.closeModal();
                        toastr.info("队列已清空 ovo");
                    }
                }, 200);
            }
        },

        closeModal() { $('#md-review-modal').remove(); },

        generateTXTBackup(idsToNuke) {
            try {
                let content = "=== SillyTavern Deleted Messages Backup ===\n";
                content += `Date: ${new Date().toLocaleString()}\n\n`;
                idsToNuke.slice().reverse().forEach(id => {
                    // ★ 修复：不再使用 import 引入的 chat，而是从 window 获取
                    const msg = window.chat[id];
                    if(msg) {
                        const name = msg.name || (msg.is_user ? "You" : "Character");
                        content += `[ID: ${id}] ${name}:\n${msg.mes}\n\n------------------------\n\n`;
                    }
                });
                const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `ST_Deleted_Backup_${new Date().getTime()}.txt`;
                a.click(); URL.revokeObjectURL(url);
            } catch (e) {}
        },

        generateChatFileForMove(idsToMove) {
            try {
                let userName = "User", charName = "Character";
                // ★ 修复：从 window 获取 chat
                for (let i = 0; i < window.chat.length; i++) {
                    if (window.chat[i].is_user) userName = window.chat[i].name || userName;
                    if (!window.chat[i].is_user && !window.chat[i].is_system) charName = window.chat[i].name || charName;
                }
                let jsonlContent = JSON.stringify({ user_name: userName, character_name: charName, create_date: Date.now(), chat_metadata: {} }) + "\n";
                idsToMove.slice().sort((a,b) => a - b).forEach(id => { if(window.chat[id]) jsonlContent += JSON.stringify(window.chat[id]) + "\n"; });
                const blob = new Blob([jsonlContent], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `搬出聊天_${charName}_${new Date().getTime()}.jsonl`;
                a.click(); URL.revokeObjectURL(url);
            } catch (e) {}
        },

        async executeDelete(isMove = false) {
            if (this.selectedIds.size === 0) return this.closeModal();
            let finalIds = Array.from(this.selectedIds);

            this.isProcessing = true;
            if (isMove) {
                $('#md-modal-move').html('<i class="fa-solid fa-spinner fa-spin"></i> 打包中...ovo').css('pointer-events', 'none');
                this.generateChatFileForMove(finalIds);
            } else {
                $('#md-modal-confirm').html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...ovo').css('pointer-events', 'none');
            }
            
            if ($('#md-export-backup').is(':checked')) this.generateTXTBackup(finalIds);

            finalIds.sort((a, b) => b - a);
            let successCount = 0;
            for (const id of finalIds) {
                // ★ 修复：从 window 获取 chat 和 deleteMessage
                if (id < window.chat.length) {
                    await window.deleteMessage(id);
                    successCount++;
                }
            }

            if (successCount > 0) {
                if (isMove) toastr.success(`成功搬走 ${successCount} 条信息！请使用酒馆的【导入聊天】功能 ovo`, "搬家完成 ovo", {timeOut: 8000});
                else toastr.success(`成功删除${successCount}条信息 ovo`);
            }
            
            this.isProcessing = false;
            this.closeModal();
            this.toggleMode();
        }
    };

    // ================= 插件注入入口 =================
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
            console.log(`${extensionName} 复古兼容版加载完成 ovo`);
        }
    }, 1000);

})(); // IIFE 结束
