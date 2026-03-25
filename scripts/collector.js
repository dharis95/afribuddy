/**
 * Agent 智能反爬采集脚本 - 按 Agent 专属领域自动分类
 * 核心逻辑：Agent 自行识别关键词并划分目录类别
 * 使用 Puppeteer 模拟真实浏览器进行反爬绕过
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const CONFIG = {
    knowledgePath: 'C:/Users/Administrator/knowledge-db',
    outputBase: 'C:/Users/Administrator/crossborder-agent/skills',
    downloadDir: 'C:/Users/Administrator/crossborder-agent/downloads'
};

/**
 * 反爬策略配置
 */
const ANTI_SCRAPE_CONFIG = {
    // 随机 User Agent 列表（真实浏览器）
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],

    // 动作延迟配置（模拟人类行为）
    delays: {
        pageLoad: 2000,      // 页面加载后等待
        random: [500, 2000], // 随机延迟范围（毫秒）
        scroll: [300, 800],  // 滚动延迟
        fetch: [1000, 3000]  // 数据请求间隔
    },

    // 模拟人类行为
    humanBehaviors: {
        mouseMove: true,
        randomClick: true,
        scrollBehavior: true
    }
};

/**
 * Agent 目录分类模板 - 每个 Agent 有自己的采集方向
 */
const AGENT_CATEGORIES = {
    // Kilimall - 专注于店铺运营和商品上架
    'kilimall': {
        base: 'Kilimall',
        dirs: {
            '店铺入驻': ['注册流程', '资质审核', '店铺装修', '品类开通'],
            '商品管理': ['上架流程', '标题优化', '主图制作', '详情页', '库存管理'],
            '订单处理': ['接单', '发货', '物流单号', '售后处理', '评价回复'],
            '客户服务': ['话术模板', '纠纷处理', '退款流程', '维权应对'],
            '营销推广': ['平台活动', '优惠券', '限时折扣', '捆绑销售', '销售数据分析']
        },
        keywords: {
            '店铺入驻': ['注册', '入驻', '资质', '审核', '开店', '认证'],
            '商品管理': ['上架', '商品', 'SKU', '标题', '图片', '详情页', '库存'],
            '订单处理': ['订单', '发货', '物流', '单号', '配送', '签收'],
            '客户服务': ['客服', '回复', '投诉', '纠纷', '退款', '差评'],
            '营销推广': ['活动', '促销', '折扣', '优惠', '流量', '转化']
        },
        // 真实采集目标（免费开放页面）
        targets: [
            {
                name: 'Kilimall 帮助中心',
                url: 'https://www.kilimall.com/help',
                type: 'article'
            },
            {
                name: 'Kilimall 新手指南',
                url: 'https://www.kilimall.com/new-seller-guide',
                type: 'guide'
            }
        ]
    },

    // TikTok - 专注于短视频流量和独立站转化
    'tiktok-africa': {
        base: 'TikTok',
        dirs: {
            '短视频玩法': ['脚本创作', '拍摄技巧', '剪辑方法', '热门话题', '音乐使用'],
            '直播引流': ['开播准备', '互动话术', '福袋设置', '连麦技巧', '转化路径'],
            '独立站转化': ['引流设计', '落地页', '购物车设置', '支付流程', '用户留存'],
            '用户运营': ['粉丝增长', '评论互动', '私信营销', '社群建设', '复购提升'],
            '流量变现': ['带货技巧', '佣金计算', '广告投放', '达人合作', '数据复盘']
        },
        keywords: {
            '短视频玩法': ['短视频', 'TikTok', '脚本', '拍摄', '剪辑', '热门', '话题'],
            '直播引流': ['直播', '开播', '互动', '福袋', '转化', '下单'],
            '独立站转化': ['独立站', '落地页', '购物车', '支付', '跳转'],
            '用户运营': ['粉丝', '评论', '私信', '社群', '复购', '留存'],
            '流量变现': ['带货', '佣金', '广告', '达人', 'ROI', '转化率']
        },
        targets: [
            {
                name: 'TikTok Africa 标签',
                url: 'https://www.tiktok.com/tag/africa',
                type: 'search'
            },
            {
                name: 'TikTok Shop 外溢',
                url: 'https://www.tiktok.com/tag/tiktokshop',
                type: 'search'
            }
        ]
    },

    // Temu - 专注于平台规则和物流
    'temu-africa': {
        base: 'Temu',
        dirs: {
            '平台规则': ['定价策略', '佣金计算', '违规处理', '申诉流程', '封店预防'],
            'DTS物流': ['发货流程', '仓库地址', '标签打印', '揽收时间', '物流查询'],
            '订单履约': ['发货时效', '取消订单', '修改地址', '物流异常'],
            '客户服务': ['CC话术', '售后 Wrapper', '退货处理', '差评应对'],
            '消费者心理': ['价格敏感', '退款原因', '复购驱动', '评价撰写习惯']
        },
        keywords: {
            '平台规则': ['Temu', '规则', '定价', '佣金', '违规', '申诉'],
            'DTS物流': ['DTS', '物流', '发货', '仓库', '揽收', '标签'],
            '订单履约': ['订单', '发货', '取消', '修改', '异常'],
            '客户服务': ['CC', '售后', '退货', '差评', '客服'],
            '消费者心理': ['价格', '退款', '复购', '评价', '心理']
        },
        targets: [
            {
                name: 'Temu 帮助中心',
                url: 'https://sellercentral.gparseIntegration.amazon.com/Help center',
                type: 'article'
            }
        ]
    },

    // Jumia - 专注于多国运营和活动策划
    'jumia': {
        base: 'Jumia',
        dirs: {
            '多国市场': ['尼日利亚', '肯尼亚', '埃及', '南非', '摩洛哥', ' Across 14 Countries'],
            '仓配服务': ['FBJ', 'FBS', '中心仓', '区域仓', '退货处理'],
            '活动策划': ['SuperSale', '618', '黑五', '年终大促', '节日营销'],
            '数据分析': ['转化率', '加购率', '退货率', '店铺评分', '竞品分析'],
            '合规要求': ['产品认证', '标签规范', '清关文件', 'VAT注册']
        },
        keywords: {
            '多国市场': ['Jumia', '尼日利亚', '肯尼亚', '埃及', '南非', '摩洛哥', '14国'],
            '仓配服务': ['FBJ', 'FBS', '仓', '配送', '退货', '物流'],
            '活动策划': ['SuperSale', '618', '黑五', '大促', '营销'],
            '数据分析': ['转化率', '加购', '退货率', '评分', '竞品'],
            '合规要求': ['认证', '标签', '清关', 'VAT', '合规']
        },
        targets: [
            {
                name: 'Jumia Nigeria',
                url: 'https://www.jumia.com.ng/',
                type: 'homepage'
            },
            {
                name: 'Jumia FAQ',
                url: 'https://www.jumia.com.ng/faq',
                type: 'article'
            }
        ]
    },

    // Takealot - 专注于南非市场和品牌入驻
    'takealot': {
        base: 'Takealot',
        dirs: {
            '平台入门': ['卖家注册', 'VAT号码', '银行账户', '产品认证', '首单准备'],
            'Listing优化': ['标题模板', '主图规范', '五点描述', '关键词', 'A+内容'],
            '物流时效': ['标准配送', '次日达', '自提点', '配送覆盖', '物流费用'],
            '品牌入驻': ['品牌申请', '唯一性审核', '品牌保证金', '品牌店铺'],
            '竞争分析': ['价格监控', '排名追踪', '评价分析', '促销对比']
        },
        keywords: {
            '平台入门': ['Takealot', '注册', 'VAT', '银行', '认证'],
            'Listing优化': ['Listing', '标题', '主图', '描述', '关键词'],
            '物流时效': ['配送', '次日达', '自提', '覆盖', '费用'],
            '品牌入驻': ['品牌', '申请', '唯一性', '保证金', '店铺'],
            '竞争分析': ['价格', '排名', '评价', '促销', '监控']
        },
        targets: [
            {
                name: 'Takealot Seller',
                url: 'https://sell.takealot.com/',
                type: 'homepage'
            },
            {
                name: 'Takealot Help',
                url: 'https://www.takealot.com/help',
                type: 'article'
            }
        ]
    },

    // B2B外贸经理 - 专注于 client development
    'b2b': {
        base: 'B2B',
        dirs: {
            '客户开发': ['平台询盘', '社交媒体', '展会获客', '老客转介绍', '潜客追踪'],
            '询盘转化': ['2小时回复', '专业解答', '案例展示', '样品发送', '报价跟进'],
            '商务沟通': ['邮件模板', 'WhatsApp话术', '视频会议', '文化差异', '谈判技巧'],
            '报价策略': ['FOB报价', 'CIF报价', 'MOQ设置', '付款方式', '有效期设置'],
            '长期合作': ['定期回访', '新品推荐', '价格保护', '订单激励', '联合营销']
        },
        keywords: {
            '客户开发': ['开发', '询盘', '客户', '潜客', '追踪', '转化'],
            '询盘转化': ['回复', '解答', '案例', '样品', '报价', '跟进'],
            '商务沟通': ['邮件', 'WhatsApp', '会议', '谈判', '话术'],
            '报价策略': ['FOB', 'CIF', 'MOQ', '付款', '报价', '有效期'],
            '长期合作': ['回访', '新品', '价格', '订单', '联合', '合作']
        },
        targets: [
            {
                name: 'Alibaba Ethiopia',
                url: 'https://ethiopia.alibaba.com/',
                type: '采购网站'
            },
            {
                name: 'Made-in Africa',
                url: 'https://www.made-in-africa.com/',
                type: '采购网站'
            }
        ]
    },

    // 营销增长师 -专注于流量获取
    'marketing': {
        base: 'Marketing',
        dirs: {
            '广告投放': ['Facebook ROI', 'Instagram转化', 'WhatsApp裂变', 'TikTok广告', 'Google Ads'],
            '内容策划': ['脚本创作', '图文模板', '视频制作', '节日热点', '用户生成内容'],
            '节日营销': ['圣诞季', '黑五', '网络星期一', '新年', '开斋节', '排期表'],
            'ROI分析': ['广告花费', '转化率', '单客成本', '复购率', '客单价'],
            '渠道归因': ['首触渠道', '末触渠道', '多渠道归因', '数据看板']
        },
        keywords: {
            '广告投放': ['广告', 'ROI', 'Facebook', 'Instagram', 'TikTok', 'Google'],
            '内容策划': ['内容', '脚本', '图文', '视频', '热点'],
            '节日营销': ['节日', '圣诞', '黑五', '新年', '排期'],
            'ROI分析': ['ROI', '花费', '转化', '成本', '客单价'],
            '渠道归因': ['渠道', '归因', '首触', '末触', '数据', '看板']
        },
        targets: [
            {
                name: 'Social Media Explorer',
                url: 'https://www.socialmediaexplorer.com/',
                type: 'article'
            },
            {
                name: 'Hootsuite Blog',
                url: 'https://www.hootsuite.com/blog',
                type: 'article'
            }
        ]
    },

    // 物流规划师 -专注于仓储物流
    'logistics': {
        base: 'Logistics',
        dirs: {
            '运输方式': ['海运', '空运', '铁路', '卡车', '多式联运', '时效对比'],
            '清关流程': ['提单审核', '缴税', '检验', '放行', '清关代理'],
            '仓储合作': ['仓租', '代运营', 'VMI', 'JIT', '库内操作'],
            '最后一公里': ['本地配送', '自提点', '邮政', '摩的', '配送合作'],
            '成本优化': ['批量发货', '包装优化', '渠道选择', '谈判技巧', '费用清单']
        },
        keywords: {
            '运输方式': ['海运', '空运', '铁路', '卡车', '多式联运', '时效'],
            '清关流程': ['清关', '提单', '缴税', '检验', '放行', '代理'],
            '仓储合作': ['仓', '租赁', '代运营', 'VMI', 'JIT'],
            '最后一公里': ['配送', '末梢', '自提', '邮政', '摩的'],
            '成本优化': ['成本', '优化', '包装', '批量', '谈判']
        },
        targets: [
            {
                name: 'DHL Africa',
                url: 'https://www.dhl.com/africa',
                type: 'article'
            },
            {
                name: 'FedEx Africa',
                url: 'https://www.fedex.com/africa',
                type: 'article'
            }
        ]
    },

    // 合规顾问 -专注于政策法规
    'compliance': {
        base: 'Compliance',
        dirs: {
            '关税政策': ['进口关税', '增值税', '消费税', '特殊税', '关税结构'],
            '平台合规': ['产品认证', '标签规范', '说明书', '保修卡', '安全标准'],
            '知识产权': ['商标注册', '专利申请', '版权保护', '侵权规避', '维权流程'],
            '违规案例': ['仿品处理', '标签违规', '虚假宣传', 'revoke案例'],
            '政策追踪': ['官网查询', '行业协会', '政策变更', '过渡期']
        },
        keywords: {
            '关税政策': ['关税', '增值税', '消费税', '进口', '结构'],
            '平台合规': ['认证', '标签', '说明书', '保修', '标准'],
            '知识产权': ['商标', '专利', '版权', '侵权', '维权'],
            '违规案例': ['违规', '仿品', '标签', '虚假', '案例'],
            '政策追踪': ['政策', '变更', '官网', '协会', '过渡期']
        },
        targets: [
            {
                name: 'WTO Trade Policy',
                url: 'https://www.wto.org/english/tratop_e/tradpol_e/tradpol_e.htm',
                type: 'article'
            },
            {
                name: ' AfCFTA',
                url: 'https://avarice.africa/',
                type: 'article'
            }
        ]
    },

    // Skill技能包 -专注于技能扩展
    'skill-pack': {
        base: 'Skill',
        dirs: {
            '技能打包': ['需求识别', '资料整理', '结构化输出', '测试验证', '版本管理'],
            '工具接入': ['API集成', 'Webhook', '插件开发', 'SDK使用', '第三方工具'],
            '自动化脚本': ['Python脚本', 'JavaScript', '定时任务', '数据同步', '批量处理'],
            '数据扩展': ['数据清洗', '格式转换', 'API对接', '数据库同步', '报表生成'],
            '训练优化': ['Fine-tuning', 'RAG', 'few-shot', 'Chain-of-thought', '评估指标']
        },
        keywords: {
            '技能打包': ['打包', '识别', '整理', '结构化', '测试'],
            '工具接入': ['API', 'Webhook', '插件', 'SDK', '集成'],
            '自动化脚本': ['Python', 'JavaScript', '自动化', '定时', '批量'],
            '数据扩展': ['数据', '清洗', '转换', '同步', '报表'],
            '训练优化': ['Fine-tuning', 'RAG', 'few-shot', '评估', '优化']
        },
        targets: []
    }
};

/**
 * 反爬绕过工具
 */
class AntiScrape {
    constructor() {
        this.browser = null;
        this.pages = [];
    }

    // 生成随机延迟（模拟人类行为）
    getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 随机 User Agent
    getRandomUserAgent() {
        return ANTI_SCRAPE_CONFIG.userAgents[
            Math.floor(Math.random() * ANTI_SCRAPE_CONFIG.userAgents.length)
        ];
    }

    // 启动浏览器（stealth 模式）
    async launch() {
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-infobars',
                '--window-size=1920,1080',
                '--user-agent=' + this.getRandomUserAgent()
            ],
            defaultViewport: {
                width: 1920 + Math.floor(Math.random() * 100),
                height: 1080 + Math.floor(Math.random() * 100)
            },
            ignoreHTTPSErrors: true
        });

        // 创建初始页面
        const page = await this.browser.newPage();

        // 隐藏自动化特征
        await page.evaluateOnNewDocument(() => {
            delete navigator.__proto__.webdriver;
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
        });

        this.pages.push(page);
        return page;
    }

    // 跟随页面
    async followPage() {
        if (!this.browser) return null;
        const page = await this.browser.newPage();
        await page.setUserAgent(this.getRandomUserAgent());
        this.pages.push(page);
        return page;
    }

    // 模拟人类滚动
    async humanScroll(page) {
        await page.evaluate(() => {
            return new Promise(resolve => {
                let distance = 0;
                const height = document.body.scrollHeight;

                const scroll = () => {
                    const step = Math.floor(Math.random() * 300) + 100;
                    window.scrollBy(0, step);
                    distance += step;

                    if (distance < height) {
                        setTimeout(scroll, this.getRandomDelay(300, 800));
                    } else {
                        resolve();
                    }
                };

                setTimeout(scroll, 500);
            });
        });

        await page.waitForTimeout(this.getRandomDelay(1000, 2000));
    }

    // 模拟鼠标移动
    async humanMouseMove(page) {
        const x = Math.floor(Math.random() * 1800) + 100;
        const y = Math.floor(Math.random() * 800) + 100;

        await page.mouse.move(x, y);
        await page.waitForTimeout(this.getRandomDelay(200, 500));
    }

    // 随机点击
    async randomClick(page) {
        await page.evaluate(() => {
            const elements = document.querySelectorAll('a, button, div, span');
            if (elements.length > 0) {
                const el = elements[Math.floor(Math.random() * elements.length)];
                el.click();
            }
        });
        await page.waitForTimeout(this.getRandomDelay(500, 1500));
    }

    // 访问页面
    async visitPage(url) {
        const page = await this.followPage();

        // 设置请求拦截（模拟真实请求）
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 访问页面
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 模拟人类行为
        await this.humanScroll(page);

        // 模拟鼠标移动
        if (Math.random() > 0.5) {
            await this.humanMouseMove(page);
        }

        return page;
    }

    // 等待元素出现
    async waitForSelector(page, selector, timeout = 10000) {
        try {
            await page.waitForSelector(selector, { timeout });
            return true;
        } catch (e) {
            return false;
        }
    }

    // 获取页面内容
    async getPageContent(page) {
        return await page.evaluate(() => {
            // 移除脚本和样式
            const removeElements = (selector) => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            };
            removeElements('script');
            removeElements('style');
            removeElements('nonce');

            return {
                title: document.title,
                url: window.location.href,
                text: document.body.innerText.replace(/\s+/g, ' ').substring(0, 50000),
                h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()),
                h2: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()),
                links: Array.from(document.querySelectorAll('a')).map(a => ({
                    text: a.innerText.trim(),
                    href: a.href
                }))
            };
        });
    }

    // 关闭所有页面
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

/**
 * 智能关键词匹配 - 自动分类
 */
function classifyContent(agentId, content) {
    const agentConfig = AGENT_CATEGORIES[agentId];
    if (!agentConfig) return null;

    const keywords = agentConfig.keywords;
    const matchedDirs = [];

    for (const [dirName, dirKeywords] of Object.entries(keywords)) {
        let matchCount = 0;
        for (const kw of dirKeywords) {
            if (content.toLowerCase().includes(kw.toLowerCase())) {
                matchCount++;
            }
        }
        if (matchCount >= 2) {
            matchedDirs.push({ dir: dirName, score: matchCount });
        }
    }

    matchedDirs.sort((a, b) => b.score - a.score);
    return {
        matchedDirs: matchedDirs.slice(0, 3),
        allDirs: Object.keys(keywords)
    };
}

/**
 * 提取文本内容（简洁版）
 */
function extractText(content) {
    if (!content) return '';

    // 移除 URL
    let text = content.replace(/https?:\/\/[^\s]+/g, '');
    // 移除邮箱
    text = text.replace(/[^\s]+@[^\s]+/g, '');
    // 移除多余空白
    text = text.replace(/\s+/g, ' ').trim();
    // 限制长度
    return text.substring(0, 10000);
}

/**
 * 保存采集结果到知识库
 */
function saveToKnowledgeBase(agentId, category, data) {
    const knowledgeDir = path.join(CONFIG.knowledgePath, agentId);
    fs.ensureDirSync(knowledgeDir);

    // 分类保存
    const categoryPath = path.join(knowledgeDir, category);
    fs.ensureDirSync(categoryPath);

    // 生成文件名
    const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.txt`;
    const filepath = path.join(categoryPath, filename);

    // 保存内容
    const content = `
采集时间: ${data.timestamp}
采集源: ${data.source}
原标题: ${data.title || ''}
URL: ${data.url || ''}

${data.text}
`.trim();

    fs.writeFileSync(filepath, content, 'utf-8');

    console.log(`✓ 已保存: ${filepath} (${data.text.length} 字符)`);

    return filepath;
}

/**
 * 采集单个目标
 */
async function collectTarget(agentId, target) {
    console.log(`  [${target.name}] 开始采集...`);

    const scraper = new AntiScrape();
    let page = null;

    try {
        page = await scraper.launch();

        // 模拟访问
        console.log(`    访问: ${target.url}`);
        page = await scraper.visitPage(target.url);

        // 等待页面加载
        await page.waitForTimeout(3000);

        // 获取内容
        const content = await scraper.getPageContent(page);

        // 分类
        const classification = classifyContent(agentId, content.text || '');
        console.log(`    分类结果: ${classification ? classification.matchedDirs.map(d => d.dir).join(', ') : '未匹配'}`);

        // 保存到对应分类
        if (classification && classification.matchedDirs.length > 0) {
            const topDir = classification.matchedDirs[0].dir;
            await saveToKnowledgeBase(agentId, topDir, {
                text: content.text || '',
                title: content.title || target.name,
                url: target.url,
                timestamp: new Date().toISOString(),
                source: target.name
            });
        }

        return { success: true, contentLength: content.text?.length || 0 };

    } catch (error) {
        console.error(`    采集失败: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        if (page) await page.close();
        await scraper.close();
    }
}

/**
 * 为 Agent 生成模拟知识（用于演示）
 */
function generateSampleKnowledge(agentId) {
    const agentConfig = AGENT_CATEGORIES[agentId];
    if (!agentConfig) return null;

    const knowledge = {
        collectedAt: new Date().toISOString(),
        agentId: agentId,
        base: agentConfig.base,
        categories: {},
        meta: {
            totalDirs: Object.keys(agentConfig.dirs).length,
            totalKeywords: Object.values(agentConfig.keywords).flat().length
        }
    };

    // 为每个目录生成知识
    for (const [dirName, items] of Object.entries(agentConfig.dirs)) {
        knowledge.categories[dirName] = {
            name: dirName,
            items: items,
            keywords: agentConfig.keywords[dirName] || [],
            description: `_${agentConfig.base} ${dirName} 相关知识整理_`,
            sampleContent: `【${agentConfig.base} - ${dirName}】\n\n知识要点:\n${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n优化建议: 基于实际运营数据持续改进。`,
            timestamp: new Date().toISOString()
        };
    }

    return knowledge;
}

/**
 * 采集单个 Agent
 */
async function collectAgent(agentId) {
    console.log(`\n═══════════════════════════════════════`);
    console.log(`   Agent: ${agentId}`);
    console.log(`═══════════════════════════════════════`);

    const agentConfig = AGENT_CATEGORIES[agentId];
    if (!agentConfig) {
        console.log(`未知 Agent ID: ${agentId}`);
        return null;
    }

    console.log(`基础领域: ${agentConfig.base}`);
    console.log(`目录分类: ${Object.keys(agentConfig.dirs).join(' | ')}`);
    console.log(`关键词总数: ${Object.values(agentConfig.keywords).flat().length}`);
    console.log(`采集目标: ${agentConfig.targets?.length || 0} 个`);

    // 如果有真实采集目标，进行反爬采集
    if (agentConfig.targets && agentConfig.targets.length > 0) {
        console.log(`\n[真实采集] 开始反爬采集...\n`);

        for (let i = 0; i < agentConfig.targets.length; i++) {
            const target = agentConfig.targets[i];
            const result = await collectTarget(agentId, target);

            // 采集间隔（模拟人类）
            if (i < agentConfig.targets.length - 1) {
                const delay = Math.floor(Math.random() * 2000) + 3000;
                console.log(`\n等待 ${delay}ms 后继续...\n`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // 生成示例知识（填充空目录）
    const sampleKnowledge = generateSampleKnowledge(agentId);

    const knowledgeDir = path.join(CONFIG.knowledgePath, agentId);
    fs.ensureDirSync(knowledgeDir);

    // 保存目录分类信息
    const categoriesFile = path.join(knowledgeDir, '_categories.json');
    fs.writeFileSync(categoriesFile, JSON.stringify(sampleKnowledge, null, 2));

    console.log(`\n[完成] ${agentId} 采集完成`);
    console.log(`收集知识: ${Object.keys(sampleKnowledge.categories).length} 个分类`);

    return sampleKnowledge;
}

/**
 * 主函数
 */
async function main() {
    const agentId = process.argv[2] || 'all';

    console.log('═══════════════════════════════════════');
    console.log('   AfriBuddy Agent 反爬采集系统');
    console.log('   针对 Agent 领域自动分类');
    console.log('═══════════════════════════════════════\n');

    if (agentId === 'all') {
        for (const id of Object.keys(AGENT_CATEGORIES)) {
            await collectAgent(id);
        }
    } else {
        await collectAgent(agentId);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('   全部采集完成');
    console.log('═══════════════════════════════════════');
}

module.exports = {
    collectAgent,
    AntiScrape,
    AGENT_CATEGORIES,
    classifyContent,
    generateSampleKnowledge,
    main
};

if (require.main === module) {
    main().catch(console.error);
}
