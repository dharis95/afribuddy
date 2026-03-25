const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API 配置
let CONFIG = {
    apiKey: '',
    knowledgePath: 'C:/Users/Administrator/knowledge-db'
};

// 读取配置
const fs = require('fs');
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
    CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// 保存配置
app.post('/api/config', (req, res) => {
    const { apiKey, knowledgePath } = req.body;
    if (apiKey) CONFIG.apiKey = apiKey;
    if (knowledgePath) CONFIG.knowledgePath = knowledgePath;
    fs.writeFileSync(configPath, JSON.stringify(CONFIG, null, 2));
    res.json({ success: true });
});

// Agent 列表
app.get('/api/agents', (req, res) => {
    res.json({
        agents: [
            { id: 'tiktok-africa', name: 'TikTok 非洲流量官', icon: '🎬', desc: 'TikTok 非洲流量运营专家，专注于通过流量引导至独立站的转化路径', features: ['短视频引流策划', '直播流量引导', '独立站承接优化', '用户留存策略'] },
            { id: 'kilimall', name: 'Kilimall 东非开店官', icon: '🇰🇪', desc: 'Kilimall 平台东非市场运营，从卖家注册流程拆解到商品上架优化路径', features: ['注册入驻流程', '资质审核要点', '商品上架优化', '东非热销品类数据'] },
            { id: 'temu-africa', name: 'Temu 非洲本土化顾问', icon: '🛍️', desc: 'Temu 非洲市场本土化运营，非洲消费者购买力分层数据、本土定价策略路径拆解', features: ['非洲消费力分层', '本土定价策略', 'DTS 物流时效', 'CC 售后流程'] },
            { id: 'jumia', name: 'Jumia 全非洲运营师', icon: '🌍', desc: 'Jumia 平台 14 国运营数据拆解，各国品类差异、FBJ vs FBS 仓配成本对比', features: ['14 国品类差异', 'FBJ vs FBS 成本对比', '跨境物流路径拆解', '大促报名节奏'] },
            { id: 'takealot', name: 'Takealot 南非专家', icon: '🇿🇦', desc: 'Takealot 平台南非市场运营，高客单价品类数据、Listing 排名因素拆解', features: ['南非热销品类数据', 'Listing 排名因素', 'Takealot 物流时效', '品牌入驻流程'] },
            { id: 'b2b', name: '非洲 B2B 外贸经理', icon: '💼', desc: '非洲 B2B 外贸独立站运营，大客户开发路径拆解、询盘转化数据', features: ['大客户开发路径', '询盘转化数据', 'WhatsApp 商务案例', '独立站 SEO 策略'] },
            { id: 'marketing', name: '非洲营销增长师', icon: '📣', desc: '非洲市场全渠道营销数据拆解，Facebook/Instagram 广告 ROI 案例、WhatsApp 裂变路径', features: ['Facebook 广告 ROI 案例', 'WhatsApp 裂变路径', 'Instagram 内容策略', '非洲节日营销日历'] },
            { id: 'logistics', name: '非洲物流规划师', icon: '🚢', desc: '非洲跨境物流体系拆解，海运/空运/本地配送成本对比路径', features: ['海运 vs 空运成本对比', '各国清关流程差异', '本地仓合作模式', '最后一公里方案'] },
            { id: 'compliance', name: '非洲合规顾问', icon: '⚖️', desc: '非洲各国跨境政策拆解，进口关税结构对比、平台合规要求差异', features: ['各国关税结构对比', '平台合规要求差异', '知识产权注册路径', '常见违规案例'] },
            { id: 'skill-pack', name: 'Skill 技能包', icon: '📦', desc: 'AI Skill 技能打包能力，可接入龙虾等外部工具，提供专业技能扩展', features: ['Skill技能打包', '龙虾工具接入', '自动化脚本', '多平台同步'] }
        ]
    });
});

// 知识库读取
app.get('/api/knowledge', async (req, res) => {
    try {
        const { category, type } = req.query;

        if (!category) {
            return res.json({ documents: [] });
        }

        // 读取本地知识库
        const knowledgeDir = CONFIG.knowledgePath || 'C:/Users/Administrator/knowledge-db';
        const categoryPath = path.join(knowledgeDir, category);

        if (fs.existsSync(categoryPath)) {
            const files = fs.readdirSync(categoryPath);
            const documents = files.map(file => ({
                name: file,
                path: `${category}/${file}`
            }));
            return res.json({ documents });
        }

        res.json({ documents: [] });
    } catch (e) {
        res.json({ documents: [] });
    }
});

// 文档内容
app.get('/api/knowledge/content', async (req, res) => {
    try {
        const { path: filePath } = req.query;
        if (!filePath) return res.json({ content: '' });

        const docPath = path.join(CONFIG.knowledgePath, filePath);
        if (fs.existsSync(docPath)) {
            const content = fs.readFileSync(docPath, 'utf-8');
            res.json({ content });
        } else {
            res.json({ content: '文档不存在' });
        }
    } catch (e) {
        res.json({ content: '读取失败' });
    }
});

// Chat 接口
app.post('/api/chat', async (req, res) => {
    const { message, agentId, apiKey, knowledgePath } = req.body;

    if (!message) {
        return res.json({ error: '消息不能为空' });
    }

    // 保存配置
    if (apiKey) CONFIG.apiKey = apiKey;
    if (knowledgePath) CONFIG.knowledgePath = knowledgePath;

    try {
        // 读取 Agent 相关知识
        let context = '';
        if (agentId && knowledgePath) {
            const knowledgeDir = knowledgePath;
            const agentPath = path.join(knowledgeDir, agentId);

            if (fs.existsSync(agentPath)) {
                const files = fs.readdirSync(agentPath);
                if (files.length > 0) {
                    context = `\n\n【已读取的 Agent 知识】\n`;
                    for (const file of files.slice(0, 3)) {
                        const content = fs.readFileSync(path.join(agentPath, file), 'utf-8');
                        context += `\n--- ${file} ---\n${content.substring(0, 1000)}...\n`;
                    }
                }
            }
        }

        // 调用 DashScope API
        let reply = '';
        if (CONFIG.apiKey) {
            try {
                const response = await fetch('https://coding.dashscope.aliyuncs.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${CONFIG.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'qwen3-coder-next',
                        messages: [
                            {
                                role: 'system',
                                content: `你是一个跨境电商运营专家，擅长用温暖、陪伴的方式帮助用户。请用"跨境伴读"的方式回答，不要像老师教学生，要像朋友一起进步。\n\n当前 Agent: ${agentId}\n用户问题: ${message}\n\n${context}`
                            },
                            { role: 'user', content: message }
                        ]
                    })
                });

                const data = await response.json();
                reply = data.choices[0].message.content;
            } catch (e) {
                console.error('API 调用失败:', e);
                reply = '当前为演示模式，无法调用真实 AI。请配置 DashScope API Key 来启用完整功能。\n\n您的问题: ' + message;
            }
        } else {
            reply = '当前为演示模式，请在设置中配置 DashScope API Key 来启用真实 AI 回答。\n\n您的问题: ' + message;
        }

        res.json({ reply });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// Stats 接口
app.get('/api/stats', (req, res) => {
    res.json({
        stats: {
            totalAgents: 10,
            totalMessages: 0,
            activeUsers: 0,
            moodDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
    });
});

// Reminders
app.post('/api/reminders', (req, res) => {
    res.json({ success: true });
});

// ═══════════════ AGENT COLLECT API ═══════════════
// 启动数据采集
app.post('/api/collect', (req, res) => {
    const { agentId } = req.body;

    if (!agentId) {
        return res.json({ error: 'agentId is required' });
    }

    console.log(`启动采集: ${agentId}`);

    // 执行采集脚本
    const cmd = `node scripts/collector.js ${agentId}`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`采集错误: ${error.message}`);
            return res.json({ success: false, error: error.message });
        }
        console.log(`采集输出: ${stdout}`);
        res.json({
            success: true,
            message: `Agent ${agentId} 采集完成`,
            output: stdout
        });
    });
});

// 获取采集状态
app.get('/api/collect/status', (req, res) => {
    res.json({
        status: 'running',
        agents: [
            { id: 'kilimall', name: 'Kilimall 东非开店官', lastCollect: null, status: 'pending' },
            { id: 'tiktok-africa', name: 'TikTok 非洲流量官', lastCollect: null, status: 'pending' },
            { id: 'temu-africa', name: 'Temu 非洲本土化顾问', lastCollect: null, status: 'pending' },
            { id: 'jumia', name: 'Jumia 全非洲运营师', lastCollect: null, status: 'pending' },
            { id: 'takealot', name: 'Takealot 南非专家', lastCollect: null, status: 'pending' },
            { id: 'b2b', name: '非洲 B2B 外贸经理', lastCollect: null, status: 'pending' },
            { id: 'marketing', name: '非洲营销增长师', lastCollect: null, status: 'pending' },
            { id: 'logistics', name: '非洲物流规划师', lastCollect: null, status: 'pending' },
            { id: 'compliance', name: '非洲合规顾问', lastCollect: null, status: 'pending' },
            { id: 'skill-pack', name: 'Skill 技能包', lastCollect: null, status: 'pending' }
        ]
    });
});

// ═══════════════ AGENT TRAIN API ═══════════════
// 启动 Agent 训练
app.post('/api/train', (req, res) => {
    const { agentId } = req.body;

    if (!agentId) {
        return res.json({ error: 'agentId is required' });
    }

    console.log(`启动训练: ${agentId}`);

    // 执行训练脚本
    const cmd = `node scripts/trainer.js ${agentId}`;
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`训练错误: ${error.message}`);
            return res.json({ success: false, error: error.message });
        }
        console.log(`训练输出: ${stdout}`);
        res.json({
            success: true,
            message: `Agent ${agentId} 训练完成`,
            output: stdout
        });
    });
});

// 获取训练状态
app.get('/api/train/status', (req, res) => {
    const skillsDir = path.join(__dirname, 'skills');

    // 读取训练结果
    const agents = [];
    const agentIds = ['kilimall', 'tiktok-africa', 'temu-africa', 'jumia', 'takealot', 'b2b', 'marketing', 'logistics', 'compliance', 'skill-pack'];

    for (const id of agentIds) {
        const summaryPath = path.join(skillsDir, id, '_training_summary.json');
        let status = 'not_trained';
        let skillsCount = 0;

        if (fs.existsSync(summaryPath)) {
            try {
                const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
                status = 'trained';
                skillsCount = summary.totalSkills || 0;
            } catch (e) {}
        }

        agents.push({
            id: id,
            status: status,
            skillsCount: skillsCount
        });
    }

    res.json({ status: 'running', agents: agents });
});

// 首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║     AfriBuddy - 跨境伴读 已启动                    ║
║                                                    ║
║     访问地址：http://localhost:${PORT}                ║
║     模式：${CONFIG.apiKey ? 'AI 模式' : '演示模式'}                ║
║                                                    ║
║     按 Ctrl+C 停止服务                             ║
╚════════════════════════════════════════════════════╝
    `);
});
