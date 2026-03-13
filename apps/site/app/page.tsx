import { ArrowRightIcon } from '@components/icons';
import type { Metadata } from 'next';
import Image from 'next/image';
import { MdxIcon } from 'nextra/icons';
import { Link } from 'nextra-theme-docs';
import docsCardDark from 'public/assets/card-1.dark.png';
import docsCard from 'public/assets/card-1.png';
import { Feature, Features } from './_components/features';
import { MotionDiv, MotionH3 } from './_components/framer-motion';
import { I18n } from './_components/i18n-demo';
import styles from './page.module.css';
import './page.css';
import type { FC } from 'react';

export const metadata: Metadata = {
  description:
    'MTPC (Multi-Tenant Permission Core) - 业务无关、可嵌入、可组合的多租户权限内核',
};

const IndexPage: FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20 dark:border-slate-700/50 shadow-lg">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">开源权限内核</span>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">
            MTPC
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-300 mb-8 leading-relaxed">
            业务无关、可嵌入、可组合的多租户权限内核
            <br />
            为现代 SaaS 应用提供强大而灵活的权限控制
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/docs/getting-started" 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300 shadow-xl"
            >
              开始使用
            </Link>
            <Link 
              href="/docs/architecture" 
              className="border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-8 py-4 rounded-lg font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-all duration-300"
            >
              了解架构
            </Link>
          </div>
          
          <div className="mt-12 text-sm text-slate-500 dark:text-slate-400">
            TypeScript • 框架无关 • 插件化扩展 • 类型安全
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              title="业务无关"
              description="核心不包含具体业务模型，仅提供抽象与派生能力，适用于各种业务场景"
              icon="🏗️"
            />
            <FeatureCard
              title="Schema 驱动"
              description="Resource Definition 是唯一权威来源，其它一切均由其派生"
              icon="📐"
            />
            <FeatureCard
              title="编译期优先"
              description="能在编译期生成的内容绝不推迟到运行期，确保类型安全与一致性"
              icon="⚡"
            />
            <FeatureCard
              title="库而非服务"
              description="以内嵌库方式运行，不是独立微服务，易于集成到现有项目"
              icon="📦"
            />
            <FeatureCard
              title="可扩展设计"
              description="所有企业级能力通过插件、钩子与策略扩展，而非硬编码"
              icon="🔌"
            />
            <FeatureCard
              title="默认拒绝"
              description="权限校验失败即拒绝访问，不存在'隐式放行'，确保安全性"
              icon="🔒"
            />
          </div>
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4">
              5 分钟快速上手
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              从安装到第一个权限检查，只需几个简单步骤
            </p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">终端</span>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <span className="text-slate-500 dark:text-slate-400">$</span>
                  <span className="text-slate-800 dark:text-white">npm install @mtpc/core zod</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-500 dark:text-slate-400">$</span>
                  <span className="text-slate-800 dark:text-white">pnpm add @mtpc/core zod</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-500 dark:text-slate-400">$</span>
                  <span className="text-slate-800 dark:text-white">yarn add @mtpc/core zod</span>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <pre className="text-sm text-slate-800 dark:text-slate-200 overflow-x-auto">
{`import { createMTPC, defineResource } from '@mtpc/core'
import { z } from 'zod'

// 创建 MTPC 实例
const mtpc = createMTPC()

// 定义资源
const userResource = defineResource({
  name: 'user',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email()
  }),
  features: {
    creatable: true,
    readable: true,
    updatable: true,
    deletable: true
  }
})

// 注册资源并初始化
mtpc.registerResource(userResource)
await mtpc.init()

// 检查权限
const result = await mtpc.checkPermission({
  tenant: { id: 'tenant-001' },
  subject: { id: 'user-123', type: 'user' },
  resource: 'user',
  action: 'create'
})

console.log(result.allowed) // true/false`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ecosystem Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 dark:text-white mb-4">
              完整的生态系统
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              丰富的扩展包和适配器，满足各种业务需求
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <EcosystemCard
              title="核心包"
              packages={['@mtpc/core', '@mtpc/rbac', '@mtpc/shared']}
              description="提供基础的权限控制能力"
            />
            <EcosystemCard
              title="框架适配器"
              packages={['@mtpc/adapter-hono', '@mtpc/adapter-drizzle', '@mtpc/adapter-react', '@mtpc/adapter-vue']}
              description="支持多种 Web 框架和数据库"
            />
            <EcosystemCard
              title="官方扩展"
              packages={['@mtpc/policy-cache', '@mtpc/audit', '@mtpc/data-scope', '@mtpc/soft-delete']}
              description="企业级功能扩展"
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-blue-600/10 to-indigo-600/10 dark:from-blue-600/20 dark:to-indigo-600/20 backdrop-blur-sm rounded-2xl p-8 border border-blue-200/50 dark:border-blue-800/50">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-4">
              准备开始了吗？
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
              加入我们，为你的应用构建强大而灵活的权限系统
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/docs/getting-started" 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300 shadow-xl"
              >
                开始使用 →
              </Link>
              <Link 
                href="/docs/tutorials" 
                className="border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 px-8 py-4 rounded-lg font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-all duration-300"
              >
                查看教程
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
};

interface EcosystemCardProps {
  title: string;
  packages: string[];
  description: string;
}

const EcosystemCard: React.FC<EcosystemCardProps> = ({ title, packages, description }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">{title}</h3>
      <div className="space-y-2 mb-4">
        {packages.map((pkg: string) => (
          <div key={pkg} className="bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300">
            {pkg}
          </div>
        ))}
      </div>
      <p className="text-slate-600 dark:text-slate-300 text-sm">{description}</p>
    </div>
  );
};

export default IndexPage;
