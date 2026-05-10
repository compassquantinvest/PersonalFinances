import { researchPortfolioTabs } from '../data/defaultData'
import { formatMemberRole } from './members'

/**
 * @param {string} activePage
 * @param {import('../types.js').Member | null} selectedMember
 * @param {string} activeResearchTab
 */
export function getPageMeta(activePage, selectedMember, activeResearchTab) {
  if (activePage === 'carteiras') {
    const activeTab = researchPortfolioTabs.find((tab) => tab.id === activeResearchTab)
    return {
      eyebrow: 'Pesquisa',
      title: activeTab?.label ?? 'Carteiras recomendadas',
      subtitle: 'Suno, XP e Finclass lado a lado, com destaque para ativos em comum.',
      tag: 'Research',
      tagColor: '#ffb454',
    }
  }

  if (activePage === 'cadastros') {
    return {
      eyebrow: 'Base',
      title: 'Cadastros da familia',
      subtitle: 'Membros, ativos e estrutura base da carteira.',
      tag: formatMemberRole(selectedMember?.role),
      tagColor: selectedMember?.accent ?? '#58d7ff',
    }
  }

  if (activePage === 'lancamentos') {
    return {
      eyebrow: 'Fluxo',
      title: 'Compras e dividendos',
      subtitle: 'Lance aportes e proventos por membro e ativo.',
      tag: formatMemberRole(selectedMember?.role),
      tagColor: selectedMember?.accent ?? '#58d7ff',
    }
  }

  if (activePage === 'lucros') {
    return {
      eyebrow: 'Resultado',
      title: 'Historico de Lucros e Perdas',
      subtitle: 'Operacoes de venda realizadas com custo medio, valor de venda e resultado.',
      tag: formatMemberRole(selectedMember?.role),
      tagColor: selectedMember?.accent ?? '#58d7ff',
    }
  }

  if (activePage === 'relatorios') {
    return {
      eyebrow: 'Analise',
      title: 'Relatorios',
      subtitle: 'Visao consolidada por mes de compras, vendas, dividendos, taxas e resultado realizado.',
      tag: formatMemberRole(selectedMember?.role),
      tagColor: selectedMember?.accent ?? '#58d7ff',
    }
  }

  return {
    eyebrow: 'Home',
    title: `Visao patrimonial de ${selectedMember?.name ?? 'sua familia'}`,
    subtitle: 'Ativos por classe, ordenacao customizavel e comparativo com Suno, XP e Finclass.',
    tag: formatMemberRole(selectedMember?.role),
    tagColor: selectedMember?.accent ?? '#58d7ff',
  }
}
