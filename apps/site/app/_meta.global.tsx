import type { MetaRecord } from 'nextra'
import { LinkArrowIcon } from 'nextra/icons'
import type { FC, ReactNode } from 'react'
import { useMDXComponents } from '../mdx-components'

// eslint-disable-next-line react-hooks/rules-of-hooks -- isn't react hook
// biome-ignore lint/correctness/useHookAtTopLevel: <1>
const { code: Code } = useMDXComponents()

const ExternalLink: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      {children}&thinsp;
      <LinkArrowIcon
        // based on font-size
        height="1em"
        className="x:inline x:align-baseline x:shrink-0"
      />
    </>
  )
}

const FILE_CONVENTIONS: MetaRecord = {
  _: {
    type: 'separator',
    title: 'Files'
  },
  'page-file': 'page.mdx',
  'meta-file': '_meta.js',
  _2: {
    href: 'https://nextjs.org/docs/app/api-reference/file-conventions/page',
    title: <ExternalLink>page.jsx</ExternalLink>
  },
  _3: {
    href: 'https://nextjs.org/docs/app/api-reference/file-conventions/layout',
    title: <ExternalLink>layout.jsx</ExternalLink>
  },
  _4: {
    type: 'separator',
    title: 'Top-Level Files'
  },
  'mdx-components-file': 'mdx-components.js',
  _5: {
    type: 'separator',
    title: 'Top-Level Folders'
  },
  'content-directory': 'content',
  'src-directory': 'src',
  _6: {
    href: 'https://nextjs.org/docs/app/getting-started/installation?utm_source=nextra.site&utm_medium=referral&utm_campaign=sidebar#create-the-app-directory',
    title: <ExternalLink>app</ExternalLink>
  },
  _7: {
    href: 'https://nextjs.org/docs/app/building-your-application/optimizing/static-assets?utm_source=nextra.site&utm_medium=referral&utm_campaign=sidebar',
    title: <ExternalLink>public</ExternalLink>
  }
}

const GUIDE: MetaRecord = {
  markdown: '',
  'syntax-highlighting': '',
  link: '',
  image: '',
  ssg: '',
  i18n: '',
  'custom-css': '',
  'static-exports': '',
  search: {
    items: {
      index: '',
      ai: {
        title: <span className="badge-new">Ask AI</span>
      }
    },
    theme: {
      collapsed: false
    }
  },
  'github-alert-syntax': '',
  turbopack: '',
  _: {
    title: 'Deploying',
    href: 'https://nextjs.org/docs/app/building-your-application/deploying?utm_source=nextra.site&utm_medium=referral&utm_campaign=sidebar'
  }
}

const ADVANCED: MetaRecord = {
  npm2yarn: '',
  mermaid: '',
  'tailwind-css': '',
  latex: '',
  table: '',
  typescript: '',
  remote: ''
}

const BLOG_THEME: MetaRecord = {
  start: '',
  'get-posts-and-tags': '',
  // prettier-ignore
  posts: <><Code>/posts</Code>&nbsp;Page</>,
  // prettier-ignore
  tags: <><Code>/tags/:id</Code>&nbsp;Page</>,
  // prettier-ignore
  rss: <><Code>/rss.xml</Code>&nbsp;Route</>
}

export default {
  index: {
    type: 'page',
    display: 'hidden'
  },
  docs:{
    type: 'page',
    title: '文档',
    items:{
      index:'',
      'getting-started': {
        title: '快速开始',
      },
      architecture: {
        title: '架构概览',
      },
      packages: {
        title: '核心包',
        items: {
          core: { title: '@mtpc/core' },
          rbac: { title: '@mtpc/rbac' },
          'adapter-hono': { title: '@mtpc/adapter-hono' },
          'adapter-drizzle': { title: '@mtpc/adapter-drizzle' },
        },
      },
      api:{
        title:'API',
        items:{
          core: { title: 'Core API' },
          rbac: { title: 'RBAC API' },
          'adapter-hono': { title: 'Hono Adapter API' },
          'adapter-drizzle': { title: 'Drizzle Adapter API' },
        }
      },
      migration: {
        title: '迁移和升级',
        items: {
          'from-other-systems': { title: '从其他系统迁移' },
          upgrading: { title: '版本升级' },
        },
      },
      troubleshooting: {
        title: '故障排除',
        items: {
          faq: { title: '常见问题' },
          debugging: { title: '调试指南' },
        },
      },
      contributing: {
        title: '贡献指南',
      },
    }
  },
  guides: {
    type: 'page',
    title: '开发指南',
    items: {
      index:'',
      'resource-definition': { title: '资源定义最佳实践' },
      'permission-design': { title: '权限设计最佳实践' },
      'multi-tenant': { title: '多租户实现指南' },
      'performance-optimization': { title: '性能优化指南' },
      'plugin-development': { title: '插件开发指南' },
    },
  },
  extensions:{
    type: 'page',
    title: '拓展',
    items:{
      'policy-cache': { title: '@mtpc/policy-cache' },
      explain: { title: '@mtpc/explain' },
      audit: { title: '@mtpc/audit' },
      'data-scope': { title: '@mtpc/data-scope' },
      'soft-delete': { title: '@mtpc/soft-delete' },
    }
  },
  tutorials:{
    type: 'page',
    title: '示例教程',
    items:{
      'blog-api': { title: '博客 API 教程' },
      ecommerce: { title: '电商系统教程' },
      'multi-tenant-saas': { title: '多租户 SaaS 教程' },
    }
  },
  // docs: {
  //   type: 'page',
  //   title: '文档',
  //   items: {
  //     index: '',
  //     'file-conventions': { items: FILE_CONVENTIONS },
  //     guide: { items: GUIDE },
  //     advanced: { items: ADVANCED },
  //     'built-ins': '',
  //     _: {
  //       type: 'separator',
  //       title: 'Themes'
  //     },
  //     'docs-theme': {
  //       items: {
  //         start: '',
  //         'built-ins': {
  //           items: {
  //             layout: ''
  //           }
  //         }
  //       }
  //     },
  //     'blog-theme': { items: BLOG_THEME },
  //     'custom-theme': '',
  //     __: {
  //       type: 'separator',
  //       title: 'More'
  //     },
  //     'about-link': {
  //       title: 'About Nextra',
  //       href: '/about'
  //     },
  //     'next.js-link': {
  //       title: 'Next.js Docs',
  //       href: 'https://nextjs.org?utm_source=nextra.site&utm_medium=referral&utm_campaign=sidebar'
  //     },
  //     'migration-from-v3': {
  //       title: 'Migration from Nextra v3',
  //       href: 'https://the-guild.dev/blog/nextra-4?utm_source=nextra.site&utm_campaign=sidebar&utm_content=sidebar_link#nextra-theme-docs-changes'
  //     }
  //   }
  // },
  // api: {
  //   type: 'page'
  // },
  // versions: {
  //   type: 'menu',
  //   title: 'Versions',
  //   items: {
  //     _3: {
  //       title: 'Nextra v3 Docs',
  //       href: 'https://nextra-v2-7hslbun8z-shud.vercel.app'
  //     },
  //     _2: {
  //       title: 'Nextra v2 Docs',
  //       href: 'https://nextra-v2-oe0zrpzjp-shud.vercel.app'
  //     }
  //   }
  // },
  // blog: {
  //   type: 'page',
  //   theme: {
  //     typesetting: 'article',
  //     toc: false
  //   }
  // },
  // about: {
  //   type: 'page',
  //   theme: {
  //     typesetting: 'article'
  //   }
  // },
  // showcase: {
  //   type: 'page',
  //   theme: {
  //     copyPage: false,
  //     typesetting: 'article',
  //     layout: 'full',
  //     timestamp: false,
  //     toc: false
  //   }
  // },
  // sponsors: {
  //   type: 'page',
  //   theme: {
  //     copyPage: false,
  //     typesetting: 'article',
  //     layout: 'full',
  //     timestamp: false,
  //     toc: false
  //   }
  // }
}
