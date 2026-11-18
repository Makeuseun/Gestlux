/* ===========================
   GESTLUX - DADOS COMPARTILHADOS
   =========================== */
(function () {
  'use strict';

  const modulos = [
    {
      id: 1,
      tema: 'empresarial',
      titulo: 'Gestão de Projetos',
      icone: 'fa-solid fa-layer-group',
      descricao: 'Crie, atribua e acompanhe projetos com prazos, responsáveis e status em tempo real.',
      tags: ['Tarefas', 'Kanban', 'Prazos']
    },
    {
      id: 2,
      tema: 'empresarial',
      titulo: 'Financeiro & Fluxo de Caixa',
      icone: 'fa-solid fa-money-bill-wave',
      descricao: 'Controle contas a pagar e receber, acompanhe o fluxo de caixa e gere relatórios. Integração fiscal prevista.',
      tags: ['Fluxo de caixa', 'Relatórios', 'NF-e em breve']
    },
    {
      id: 3,
      tema: 'educacional',
      titulo: 'Diário de Classe Digital',
      icone: 'fa-solid fa-book-open-reader',
      descricao: 'Professores lançam notas e frequência online, acessíveis por alunos e responsáveis.',
      tags: ['Notas', 'Frequência', 'Boletim']
    },
    {
      id: 4,
      tema: 'educacional',
      titulo: 'Calendário Acadêmico',
      icone: 'fa-solid fa-calendar-days',
      descricao: 'Organize feriados, provas, reuniões e eventos escolares em um calendário compartilhado.',
      tags: ['Eventos', 'Aulas', 'Feriados']
    },
    {
      id: 5,
      tema: 'saude',
      titulo: 'Prontuário Eletrônico',
      icone: 'fa-solid fa-file-medical',
      descricao: 'Estrutura para histórico, laudos e evoluções do paciente, com requisitos de LGPD em desenho. Em desenvolvimento.',
      tags: ['Em breve', 'Laudos', 'LGPD']
    },
    {
      id: 6,
      tema: 'saude',
      titulo: 'Agenda Médica',
      icone: 'fa-solid fa-calendar-check',
      descricao: 'Agende consultas e exames com confirmação e lembretes. Integração com SMS/e-mail prevista.',
      tags: ['Agendamento', 'Lembretes', 'Horários']
    },
    {
      id: 7,
      tema: 'varejo',
      titulo: 'Controle de Estoque',
      icone: 'fa-solid fa-boxes-stacked',
      descricao: 'Monitore produtos, níveis mínimos, entradas e saídas com alertas de reposição.',
      tags: ['Estoque', 'Alertas', 'Inventário']
    },
    {
      id: 8,
      tema: 'varejo',
      titulo: 'PDV e Vendas',
      icone: 'fa-solid fa-cash-register',
      descricao: 'Ponto de venda integrado, pedidos e relatórios de vendas por canal.',
      tags: ['PDV', 'Vendas', 'Relatórios']
    }
  ];

  const configPorSetor = {
    empresarial: {
      titulo: 'Painel Empresarial',
      subtitulo: 'Gestão para {nome}',
      nomePadrao: 'Minha Empresa',
      icon: 'fa-solid fa-building',
      cor: '#2563eb',
      metrica1: 'R$ 84.200',
      metrica1Label: 'Receita mensal',
      metrica2: '23',
      metrica2Label: 'Projetos ativos',
      metrica3: '88%',
      metrica3Label: 'Taxa de conclusão',
      metrica4: '12',
      metrica4Label: 'Tarefas pendentes',
      recentes: [
        { item: 'Projeto Aurora', detalhe: '12 tarefas', valor: '88%' },
        { item: 'Fluxo de caixa', detalhe: '3 lançamentos', valor: 'R$ 18.400' },
        { item: 'Relatório mensal', detalhe: '1 documento', valor: 'Pronto' }
      ],
      chartLabel: 'Desempenho financeiro'
    },
    educacional: {
      titulo: 'Painel Educacional',
      subtitulo: 'Gestão acadêmica para {nome}',
      nomePadrao: 'Escola Modelo',
      icon: 'fa-solid fa-school',
      cor: '#7c3aed',
      metrica1: '1.240',
      metrica1Label: 'Alunos matriculados',
      metrica2: '34',
      metrica2Label: 'Turmas abertas',
      metrica3: '94%',
      metrica3Label: 'Frequência média',
      metrica4: '6',
      metrica4Label: 'Aulas hoje',
      recentes: [
        { item: 'Turma 3ºA', detalhe: '28 alunos', valor: '94%' },
        { item: 'Diário de classe', detalhe: '6 aulas', valor: 'Registrado' },
        { item: 'Boletim', detalhe: '1 turma', valor: 'Publicado' }
      ],
      chartLabel: 'Rendimento dos alunos'
    },
    saude: {
      titulo: 'Painel de Saúde',
      subtitulo: 'Gestão clínica para {nome}',
      nomePadrao: 'Clínica Saúde',
      icon: 'fa-solid fa-hospital',
      cor: '#059669',
      metrica1: '412',
      metrica1Label: 'Pacientes atendidos',
      metrica2: '18',
      metrica2Label: 'Consultas hoje',
      metrica3: '12',
      metrica3Label: 'Exames pendentes',
      metrica4: '9',
      metrica4Label: 'Exames hoje',
      recentes: [
        { item: 'Clínica geral', detalhe: '8 agendamentos', valor: 'Confirmado' },
        { item: 'Laboratório', detalhe: '4 resultados', valor: 'Disponível' },
        { item: 'Prontuário', detalhe: '1 atualização', valor: 'Salvo' }
      ],
      chartLabel: 'Atendimentos por especialidade'
    },
    varejo: {
      titulo: 'Painel de Varejo',
      subtitulo: 'Gestão comercial para {nome}',
      nomePadrao: 'Loja Central',
      icon: 'fa-solid fa-store',
      cor: '#d97706',
      metrica1: 'R$ 67.890',
      metrica1Label: 'Vendas no dia',
      metrica2: '340',
      metrica2Label: 'Itens em estoque',
      metrica3: '12',
      metrica3Label: 'Baixo estoque',
      metrica4: '9',
      metrica4Label: 'Vendas registradas',
      recentes: [
        { item: 'Camiseta Básica', detalhe: '3 unidades', valor: 'R$ 239,70' },
        { item: 'Calça Jeans', detalhe: '2 unidades', valor: 'R$ 379,80' },
        { item: 'Tênis Esportivo', detalhe: '1 unidade', valor: 'R$ 299,90' }
      ],
      chartLabel: 'Vendas por categoria'
    }
  };

  const perguntasPorSetor = {
    empresarial: [
      { key: 'nome', label: 'Nome da empresa', type: 'text', placeholder: 'Ex: Minha Empresa Ltda' },
      { key: 'detalhe', label: 'Segmento de atuação', type: 'select', options: ['Tecnologia', 'Comércio', 'Serviços', 'Indústria'] },
      { key: 'tamanho', label: 'Quantidade de funcionários', type: 'number', placeholder: 'Ex: 50' }
    ],
    educacional: [
      { key: 'nome', label: 'Nome da instituição', type: 'text', placeholder: 'Ex: Escola Modelo' },
      { key: 'detalhe', label: 'Nível de ensino', type: 'select', options: ['Educação Infantil', 'Ensino Fundamental', 'Ensino Médio', 'Ensino Superior'] },
      { key: 'tamanho', label: 'Quantidade de alunos', type: 'number', placeholder: 'Ex: 300' }
    ],
    saude: [
      { key: 'nome', label: 'Nome da clínica', type: 'text', placeholder: 'Ex: Clínica Saúde' },
      { key: 'detalhe', label: 'Especialidade', type: 'select', options: ['Clínica Médica', 'Odontologia', 'Fisioterapia', 'Psicologia'] },
      { key: 'tamanho', label: 'Quantidade de pacientes', type: 'number', placeholder: 'Ex: 120' }
    ],
    varejo: [
      { key: 'nome', label: 'Nome da loja', type: 'text', placeholder: 'Ex: Loja Central' },
      { key: 'detalhe', label: 'Tipo de varejo', type: 'select', options: ['Vestuário', 'Eletrônicos', 'Alimentos', 'Móveis'] },
      { key: 'tamanho', label: 'Quantidade de produtos', type: 'number', placeholder: 'Ex: 500' }
    ]
  };

  window.GESTLUX = { modulos, configPorSetor, perguntasPorSetor };
})();
