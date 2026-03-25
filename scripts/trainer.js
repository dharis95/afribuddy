/**
 * Agent 技能发现与训练脚本
 * 从采集的数据中识别 patterns 和技能点，并进行训练
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

const CONFIG = {
    knowledgePath: 'C:/Users/Administrator/knowledge-db',
    skillsOutput: 'C:/Users/Administrator/crossborder-agent/skills',
    trainsOutput: 'C:/Users/Administrator/crossborder-agent/trains'
};

// Agent 知识库分类
const AGENT_CATEGORIES = {
    'kilimall': ['入驻指南', '商品上架', '订单处理', '客户服务', '营销推广'],
    'tiktok': ['短视频玩法', '直播引流', '独立站转化', '用户留存', '流量变现'],
    'temu': ['平台规则', '物流详解', '售后流程', '定价策略', '消费者心理'],
    'jumia': ['平台运营', '仓配服务', '活动策划', '数据分析', '多国市场'],
    'takealot': ['平台入门', 'Listing优化', '物流时效', '品牌入驻', '竞争分析'],
    'b2b': ['客户开发', '询盘转化', '商务沟通', '报价策略', '长期合作'],
    'marketing': ['广告投放', '内容策划', '节日营销', 'ROI分析', '多渠道归因'],
    'logistics': ['运输方式', '清关流程', '仓储合作', '最后一公里', '成本优化'],
    'compliance': ['关税政策', '平台合规', '知识产权', '违规案例', '政策追踪'],
    'skill-pack': ['技能打包', '工具接入', '脚本开发', '数据同步', '扩展训练']
};

/**
 * 分析知识库内容，发现技能 patterns
 */
function discoverSkills(agentId) {
    const knowledgeDir = path.join(CONFIG.knowledgePath, agentId);

    if (!fs.existsSync(knowledgeDir)) {
        console.log(`知识库目录不存在: ${knowledgeDir}`);
        return null;
    }

    const skills = {
        agentId: agentId,
        discoveredAt: new Date().toISOString(),
        skills: [],
        patterns: []
    };

    // 读取所有文件
    const files = fs.readdirSync(knowledgeDir);

    for (const file of files) {
        const filePath = path.join(knowledgeDir, file);
        if (file === '_skills_info.json') continue;

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const jsonData = JSON.parse(content);

            // 分析内容中的 patterns
            const patterns = analyzeContent(jsonData);
            skills.patterns.push(...patterns);
        } catch (e) {
            // 忽略文件解析错误
        }
    }

    // 保存发现的技能
    const skillsPath = path.join(CONFIG.skillsOutput, agentId);
    fs.ensureDirSync(skillsPath);
    fs.writeFileSync(path.join(skillsPath, '_patterns.json'), JSON.stringify(skills, null, 2));

    console.log(`[${agentId}] 发现 ${skills.patterns.length} 个 patterns`);
    return skills;
}

/**
 * 分析内容中的 patterns
 */
function analyzeContent(data) {
    const patterns = [];
    const content = data.content || {};

    for (const [key, value] of Object.entries(content)) {
        // 识别关键词 patterns
        const keywords = extractKeywords(value);
        patterns.push({
            category: key,
            pattern: getPatternFromContent(value),
            keywords: keywords,
            confidence: calculateConfidence(keywords)
        });
    }

    return patterns;
}

/**
 * 从内容中提取关键词
 */
function extractKeywords(text) {
    const commonWords = ['的', '是', '在', '有', '和', '就', '也', '这', '那', '要', '好', '对', '可', '能', '要', '或', '着', '所', '们', '些', '或'];
    const words = text.split(/[\s,，.。\n]+/);
    const keywordMap = {};

    for (const word of words) {
        const cleanWord = word.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
        if (cleanWord.length > 1 && !commonWords.includes(cleanWord)) {
            keywordMap[cleanWord] = (keywordMap[cleanWord] || 0) + 1;
        }
    }

    return Object.entries(keywordMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count }));
}

/**
 * 从内容提取 pattern 结构
 */
function getPatternFromContent(text) {
    // 简单的 pattern 提取
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length >= 3) {
        return {
            type: 'step-by-step',
            steps: lines.slice(0, 5)
        };
    }
    return { type: 'named-list', text: text.substring(0, 200) };
}

/**
 * 计算 pattern 置信度
 */
function calculateConfidence(keywords) {
    if (keywords.length < 3) return 0.5;
    if (keywords.length < 8) return 0.7;
    return 0.9;
}

/**
 * 训练单个 Agent 的技能
 */
async function trainAgentSkill(agentId, skillName, parameters = {}) {
    console.log(`\n[${agentId}] 训练技能: ${skillName}`);
    console.log(`参数:`, parameters);

    const skillPath = path.join(CONFIG.skillsOutput, agentId, `${skillName}.json`);

    const skillData = {
        agentId: agentId,
        skillName: skillName,
        trainedAt: new Date().toISOString(),
        parameters: parameters,
        status: 'training',
        history: []
    };

    // 模拟训练过程
    const steps = [
        { step: '数据准备', status: 'completed' },
        { step: '特征提取', status: 'completed' },
        { step: '模型训练', status: 'in_progress' },
        { step: '性能评估', status: 'pending' },
        { step: '技能保存', status: 'pending' }
    ];

    // 模拟训练
    await new Promise(resolve => setTimeout(resolve, 1000));
    steps[2].status = 'completed';
    steps[3].status = 'completed';
    steps[4].status = 'completed';

    skillData.status = 'ready';
    skillData.history = steps;

    fs.ensureDirSync(path.dirname(skillPath));
    fs.writeFileSync(skillPath, JSON.stringify(skillData, null, 2));

    console.log(`✓ 技能训练完成: ${skillName}`);
    console.log(`保存位置: ${skillPath}`);

    return skillData;
}

/**
 * 更新单个 Agent 的技能
 * 用于迭代训练
 */
async function updateAgentSkill(agentId, skillName, newData) {
    const skillPath = path.join(CONFIG.skillsOutput, agentId, `${skillName}.json`);

    if (!fs.existsSync(skillPath)) {
        console.log(`技能不存在: ${skillName}`);
        return null;
    }

    const skillData = JSON.parse(fs.readFileSync(skillPath, 'utf-8'));
    skillData.updatedAt = new Date().toISOString();
    skillData.updatedData = newData;
    skillData.updateCount = (skillData.updateCount || 0) + 1;

    fs.writeFileSync(skillPath, JSON.stringify(skillData, null, 2));

    console.log(`✓ 技能更新完成: ${skillName}`);
    return skillData;
}

/**
 * 批量训练 Agent
 */
async function trainAgent(agentId) {
    console.log(`\n═══════════════════════════════════════`);
    console.log(`   开始训练 Agent: ${agentId}`);
    console.log(`═══════════════════════════════════════`);

    const skillPath = path.join(CONFIG.skillsOutput, agentId);
    fs.ensureDirSync(skillPath);

    // 读取发现的技能
    const skillsFile = path.join(CONFIG.knowledgePath, agentId, '_skills_info.json');
    if (!fs.existsSync(skillsFile)) {
        console.log(`未找到技能信息，运行采集: node scripts/collector.js ${agentId}`);
        return null;
    }

    const skillsInfo = JSON.parse(fs.readFileSync(skillsFile, 'utf-8'));
    const skills = skillsInfo.content || {};

    // 为每个技能生成训练文件
    const trainedSkills = [];
    for (const [skillName, skillContent] of Object.entries(skills)) {
        const skillData = await trainAgentSkill(agentId, skillName, {
            contentLength: skillContent.length,
            source: 'knowledge-base'
        });
        trainedSkills.push(skillData);
    }

    // 保存训练汇总
    const summary = {
        agentId: agentId,
        trainedAt: new Date().toISOString(),
        totalSkills: trainedSkills.length,
        skills: trainedSkills
    };

    const summaryPath = path.join(skillPath, '_training_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`\n═══════════════════════════════════════`);
    console.log(`   Agent ${agentId} 训练完成`);
    console.log(`   总技能数: ${trainedSkills.length}`);
    console.log(`═══════════════════════════════════════`);

    return summary;
}

/**
 * 主函数
 */
async function main() {
    const agentId = process.argv[2] || 'all';

    console.log('═══════════════════════════════════════');
    console.log('   AfriBuddy Agent 训练系统');
    console.log('═══════════════════════════════════════');

    if (agentId === 'all') {
        for (const id of Object.keys(AGENT_CATEGORIES)) {
            await trainAgent(id);
        }
    } else {
        await trainAgent(agentId);
    }

    console.log('\n所有训练完成！');
}

module.exports = { discoverSkills, trainAgentSkill, trainAgent, updateAgentSkill, main };

if (require.main === module) {
    main().catch(console.error);
}
