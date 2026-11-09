import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { supabase } from './supabase'
import './App.css'

const motivos = [
  'Insucesso na entrega',
  'Cliente recusou',
  'Endereço incorreto ou incompleto',
  'Pacote avariado',
  'Solicitação da operação',
  'Outro',
]

const formatarData = (data) => {
  if (!data) return 'Não informado'
  return new Date(data).toLocaleString('pt-BR')
}

function App() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [modo, setModo] = useState('login')

  const [cidades, setCidades] = useState([])
  const [devolucoes, setDevolucoes] = useState([])
  const [pendentes, setPendentes] = useState([])
  const [perfisEscolhidos, setPerfisEscolhidos] = useState({})
  const [nomesEntregadores, setNomesEntregadores] = useState({})
  const [recebendoId, setRecebendoId] = useState(null)
  const [rejeitandoId, setRejeitandoId] = useState(null)

  const [codigo, setCodigo] = useState('')
  const [cidadeId, setCidadeId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalhes, setDetalhes] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [sessaoRecuperacao, setSessaoRecuperacao] = useState(false)
  const [paginaAtiva, setPaginaAtiva] = useState('inicio')

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCidade, setFiltroCidade] = useState('todas')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')

  // CONTROLE DA CÂMERA E DO LEITOR DE CÓDIGO
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const videoRef = useRef(null)
  const leitorRef = useRef(null)
  const controlesCameraRef = useRef(null)
  const iniciandoCameraRef = useRef(false)

  // ENCERRA A CÂMERA E LIBERA O DISPOSITIVO
  const pararCamera = useCallback(() => {
    try {
      controlesCameraRef.current?.stop()
    } catch {
      // A câmera pode já estar encerrada.
    }

    controlesCameraRef.current = null
    iniciandoCameraRef.current = false

    const video = videoRef.current

    if (video?.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop())
      video.srcObject = null
    }

    setCameraAtiva(false)
  }, [])

  // SOLICITA PERMISSÃO E INICIA A LEITURA
  async function iniciarCamera() {
    if (iniciandoCameraRef.current || cameraAtiva) return

    setErro('')
    setSucesso('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setErro(
        'Seu navegador não permite acessar a câmera. Abra o sistema pelo Chrome ou Safari atualizado, utilizando o endereço HTTPS.'
      )
      return
    }

    iniciandoCameraRef.current = true

    let stream = null

    try {
      // Solicita diretamente ao navegador a permissão para usar a câmera.
      // A preferência é pela câmera traseira do celular.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      const video = videoRef.current

      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        iniciandoCameraRef.current = false
        setErro('Não foi possível abrir a visualização da câmera.')
        return
      }

      // Exibe a área da câmera.
      setCameraAtiva(true)

      // Aguarda a atualização visual antes de iniciar o vídeo.
      await new Promise((resolve) => requestAnimationFrame(resolve))

      video.srcObject = stream
      video.muted = true
      video.playsInline = true

      await video.play()

      // Inicializa o leitor de códigos.
      const leitor = new BrowserMultiFormatReader()
      leitorRef.current = leitor

      // Faz a leitura utilizando o fluxo de câmera já autorizado.
      const controles = await leitor.decodeFromStream(
        stream,
        video,
        (resultado) => {
          if (!resultado) return

          const codigoLido = resultado.getText().trim()

          if (codigoLido) {
            setCodigo(codigoLido)
            setSucesso(
              'Código lido com sucesso! Confira os dados antes de registrar.'
            )

            pararCamera()
          }
        }
      )

      controlesCameraRef.current = controles
      iniciandoCameraRef.current = false
    } catch (erroCamera) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }

      pararCamera()

      if (
        erroCamera?.name === 'NotAllowedError' ||
        erroCamera?.name === 'PermissionDeniedError' ||
        erroCamera?.name === 'SecurityError'
      ) {
        setErro(
          'Permissão da câmera bloqueada. Autorize o acesso à câmera nas configurações do navegador e tente novamente.'
        )
      } else if (erroCamera?.name === 'NotFoundError') {
        setErro('Nenhuma câmera foi encontrada neste celular.')
      } else if (erroCamera?.name === 'NotReadableError') {
        setErro(
          'A câmera está sendo utilizada por outro aplicativo. Feche os outros aplicativos que usam a câmera e tente novamente.'
        )
      } else {
        setErro(
          'Não foi possível iniciar a câmera. Verifique as permissões do celular e tente novamente.'
        )
      }
    } finally {
      iniciandoCameraRef.current = false
    }
  }

  // Encerra a câmera ao sair da tela de registro.
  useEffect(() => {
    if (paginaAtiva !== 'registrar' && cameraAtiva) {
      pararCamera()
    }
  }, [paginaAtiva, cameraAtiva, pararCamera])

  // Encerra a câmera ao fechar ou desmontar o aplicativo.
  useEffect(() => {
    return () => {
      try {
        controlesCameraRef.current?.stop()
      } catch {
        // Câmera já encerrada.
      }

      const video = videoRef.current

      if (video?.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop())
        video.srcObject = null
      }
    }
  }, [])

  const carregarPerfil = useCallback(async (sessao) => {
    if (!sessao) {
      setUsuario(null)
      setPerfil(null)
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('nome, perfil, ativo')
      .eq('id', sessao.user.id)
      .maybeSingle()

    setUsuario(sessao.user)

    if (error) {
      setErro('Não foi possível consultar seu perfil. Verifique as permissões do Supabase.')
      setPerfil(null)
      return
    }

    if (!data || !data.ativo) {
      setPerfil(null)
      return
    }

    setErro('')
    setPerfil(data)
  }, [])

  const carregarDevolucoes = useCallback(async () => {
    const { data, error } = await supabase
      .from('returns')
      .select(`
        id,
        codigo_rastreio,
        cidade_id,
        entregador_id,
        motivo,
        detalhes_motivo,
        status,
        criado_em,
        recebido_por,
        recebido_em
      `)
      .order('criado_em', { ascending: false })
      .limit(200)

    if (error) {
      setErro('Não foi possível carregar as devoluções. Verifique as permissões do banco.')
      return
    }

    const lista = data || []
    setDevolucoes(lista)

    const idsEntregadores = [
      ...new Set(lista.map((item) => item.entregador_id).filter(Boolean)),
    ]

    if (idsEntregadores.length === 0) {
      setNomesEntregadores({})
      return
    }

    const { data: perfisEntregadores, error: erroPerfis } = await supabase
      .from('profiles')
      .select('id, nome')
      .in('id', idsEntregadores)

    if (erroPerfis) {
      setNomesEntregadores({})
      setErro('As devoluções foram carregadas, mas não foi possível consultar os nomes dos entregadores. Confira as permissões de leitura dos perfis.')
      return
    }

    setNomesEntregadores(
      Object.fromEntries(
        (perfisEntregadores || []).map((item) => [item.id, item.nome])
      )
    )
  }, [])

  const carregarPendentes = useCallback(async () => {
    const { data, error } = await supabase.rpc('listar_cadastros_pendentes')

    if (error) {
      setErro('Não foi possível consultar os cadastros pendentes. Confirme as funções de aprovação no Supabase.')
      return
    }

    setPendentes(data || [])
  }, [])

  const atualizarDados = useCallback(async () => {
    setAtualizando(true)
    setErro('')

    await carregarDevolucoes()

    if (['admin', 'base'].includes(perfil?.perfil)) {
      await carregarPendentes()
    }

    setAtualizando(false)
  }, [carregarDevolucoes, carregarPendentes, perfil])

  async function confirmarRecebimento(devolucaoId) {
    const confirmar = window.confirm(
      'Confirma que este pacote foi recebido fisicamente pela base?'
    )

    if (!confirmar) return

    setErro('')
    setSucesso('')
    setRecebendoId(devolucaoId)

    try {
      const { error } = await supabase.rpc(
        'confirmar_recebimento_devolucao',
        { p_devolucao_id: devolucaoId }
      )

      if (error) {
        setErro('Não foi possível confirmar o recebimento. Confira se o pacote continua pendente e se seu perfil tem permissão.')
        return
      }

      setSucesso('Recebimento confirmado com sucesso!')
      await carregarDevolucoes()
    } catch {
      setErro('Ocorreu um erro ao confirmar o recebimento.')
    } finally {
      setRecebendoId(null)
    }
  }

  useEffect(() => {
    let ativo = true

    async function iniciar() {
      const { data, error } = await supabase.auth.getSession()

      if (!ativo) return

      if (error) setErro('Não foi possível verificar a sessão.')

      if (data.session) {
        await carregarPerfil(data.session)
      }

      if (ativo) setCarregando(false)
    }

    iniciar()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (evento, sessao) => {
        if (evento === 'PASSWORD_RECOVERY') {
          setSessaoRecuperacao(true)
          setModo('redefinir')
        }

        Promise.resolve().then(() => {
          if (ativo) carregarPerfil(sessao)
        })
      }
    )

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [carregarPerfil])

  useEffect(() => {
    if (!usuario || !perfil) return

    async function carregarDados() {
      const { data, error } = await supabase
        .from('cities')
        .select('id, nome')
        .order('nome')

      if (error) {
        setErro('Não foi possível carregar as cidades.')
      } else {
        setCidades(data || [])
      }

      await carregarDevolucoes()

      if (['admin', 'base'].includes(perfil.perfil)) {
        await carregarPendentes()
      }
    }

    carregarDados()
  }, [usuario, perfil, carregarDevolucoes, carregarPendentes])

  function mudarModo(novoModo) {
    setErro('')
    setSucesso('')
    setModo(novoModo)
  }

  async function entrar(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')
    setEnviando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    setEnviando(false)

    if (error) {
      setErro('Não foi possível entrar. Confira o e-mail, a senha e a confirmação do e-mail.')
    } else {
      setSenha('')
    }
  }

  async function cadastrar(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (senha.length < 8) {
      setErro('Crie uma senha com pelo menos 8 caracteres.')
      return
    }

    setEnviando(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: { nome: nome.trim() },
        emailRedirectTo: window.location.origin,
      },
    })

    setEnviando(false)

    if (error) {
      setErro(
        error.message.toLowerCase().includes('already registered')
          ? 'Este e-mail já possui cadastro. Tente entrar ou recuperar a senha.'
          : 'Não foi possível criar a conta. Confira os dados e tente novamente.'
      )
      return
    }

    if (data.session) {
      await supabase.auth.signOut()
    }

    setSenha('')
    setNome('')
    setModo('login')
    setSucesso('Solicitação enviada! Confirme seu e-mail, se solicitado, e aguarde a aprovação da equipe responsável.')
  }

  async function recuperarSenha(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!email.trim()) {
      setErro('Informe seu e-mail cadastrado.')
      return
    }

    setEnviando(true)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: window.location.origin }
    )

    setEnviando(false)

    if (error) {
      setErro(
        error.message.toLowerCase().includes('rate limit')
          ? 'O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente.'
          : 'Não foi possível enviar o link. Verifique as configurações de autenticação do Supabase.'
      )
      return
    }

    setSucesso('Se o e-mail estiver cadastrado, você receberá um link de redefinição. Confira também o spam.')
  }

  async function atualizarSenha(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (senhaNova.length < 8) {
      setErro('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }

    setEnviando(true)

    const { error } = await supabase.auth.updateUser({
      password: senhaNova,
    })

    setEnviando(false)

    if (error) {
      setErro('Não foi possível atualizar a senha. Solicite um novo link de recuperação.')
      return
    }

    setSenhaNova('')
    setSessaoRecuperacao(false)
    setModo('login')
    setSucesso('Senha atualizada com sucesso! Entre com sua nova senha.')

    await supabase.auth.signOut()
  }

  async function sair() {
    pararCamera()

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErro('Não foi possível encerrar a sessão.')
    } else {
      setPerfil(null)
      setUsuario(null)
      setModo('login')
      setPaginaAtiva('inicio')
      setErro('')
      setSucesso('')
    }
  }

  async function aprovarUsuario(id) {
    const perfilEscolhido = perfisEscolhidos[id] || 'entregador'

    setErro('')
    setSucesso('')
    setEnviando(true)

    const { error } = await supabase.rpc('aprovar_cadastro', {
      p_usuario_id: id,
      p_perfil: perfilEscolhido,
    })

    setEnviando(false)

    if (error) {
      setErro(error.message || 'Não foi possível aprovar o cadastro. Verifique suas permissões.')
      return
    }

    setPerfisEscolhidos((anterior) => {
      const atualizado = { ...anterior }
      delete atualizado[id]
      return atualizado
    })
    setSucesso('Cadastro aprovado com sucesso.')
    await carregarPendentes()
  }

  async function rejeitarUsuario(id, nomeUsuario) {
    const confirmar = window.confirm(
      `Tem certeza que deseja rejeitar o cadastro de ${nomeUsuario}? A conta será excluída permanentemente se não possuir vínculos operacionais.`
    )

    if (!confirmar) return

    setErro('')
    setSucesso('')
    setRejeitandoId(id)

    try {
      const { error } = await supabase.rpc('rejeitar_cadastro', {
        p_usuario_id: id,
      })

      if (error) {
        setErro(error.message || 'Não foi possível rejeitar o cadastro.')
        return
      }

      setPerfisEscolhidos((anterior) => {
        const atualizado = { ...anterior }
        delete atualizado[id]
        return atualizado
      })
      setSucesso('Cadastro rejeitado e conta excluída com sucesso.')
      await carregarPendentes()
    } catch {
      setErro('Ocorreu um erro ao rejeitar o cadastro.')
    } finally {
      setRejeitandoId(null)
    }
  }

  async function registrarDevolucao(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!codigo.trim() || !cidadeId || !motivo) {
      setErro('Preencha o código, a cidade e o motivo.')
      return
    }

    if (motivo === 'Outro' && !detalhes.trim()) {
      setErro('Explique o motivo da devolução.')
      return
    }

    setEnviando(true)

    const { error } = await supabase.from('returns').insert({
      codigo_rastreio: codigo.trim(),
      cidade_id: cidadeId,
      motivo,
      detalhes_motivo: motivo === 'Outro' ? detalhes.trim() : null,
      entregador_id: usuario.id,
    })

    setEnviando(false)

    if (error) {
      setErro(
        error.code === '23505'
          ? 'Este código de rastreio já foi registrado.'
          : 'Não foi possível registrar. Verifique as permissões e tente novamente.'
      )
      return
    }

    setCodigo('')
    setCidadeId('')
    setMotivo('')
    setDetalhes('')
    setSucesso('Devolução registrada! Aguarde a conferência física pela base.')

    await carregarDevolucoes()
  }

  const nomesCidades = useMemo(
    () => Object.fromEntries(cidades.map((cidade) => [cidade.id, cidade.nome])),
    [cidades]
  )

  const totalDevolucoes = devolucoes.length

  const aguardandoRecebimento = devolucoes.filter(
    (item) => item.status !== 'recebido'
  ).length

  const recebidas = devolucoes.filter(
    (item) => item.status === 'recebido'
  ).length

  const devolucoesFiltradas = useMemo(() => {
    return devolucoes.filter((item) => {
      const termo = busca.trim().toLowerCase()

      const correspondeBusca =
        !termo ||
        item.codigo_rastreio?.toLowerCase().includes(termo) ||
        nomesEntregadores[item.entregador_id]?.toLowerCase().includes(termo)

      const correspondeStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'pendente' && item.status !== 'recebido') ||
        (filtroStatus === 'recebido' && item.status === 'recebido')

      const correspondeCidade =
        filtroCidade === 'todas' || item.cidade_id === filtroCidade

      const correspondeMotivo =
        filtroMotivo === 'todos' || item.motivo === filtroMotivo

      return (
        correspondeBusca &&
        correspondeStatus &&
        correspondeCidade &&
        correspondeMotivo
      )
    })
  }, [
    devolucoes,
    busca,
    filtroStatus,
    filtroCidade,
    filtroMotivo,
    nomesEntregadores,
  ])

  const dadosPorCidade = useMemo(() => {
    const contagem = {}

    devolucoes.forEach((item) => {
      const cidade = nomesCidades[item.cidade_id] || 'Não identificada'
      contagem[cidade] = (contagem[cidade] || 0) + 1
    })

    return Object.entries(contagem).sort((a, b) => b[1] - a[1])
  }, [devolucoes, nomesCidades])

  const dadosPorMotivo = useMemo(() => {
    const contagem = {}

    devolucoes.forEach((item) => {
      contagem[item.motivo] = (contagem[item.motivo] || 0) + 1
    })

    return Object.entries(contagem).sort((a, b) => b[1] - a[1])
  }, [devolucoes])

  if (carregando) {
    return (
      <main className="app">
        <p>Carregando aplicativo...</p>
      </main>
    )
  }

  if (sessaoRecuperacao) {
    return (
      <main className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">PM</div>
            <div>
              <h1>P. MELLO</h1>
              <span>TRANSPORTES</span>
            </div>
          </div>
          <span className="status">REDEFINIR SENHA</span>
        </header>

        <section className="welcome">
          <span className="eyebrow">CONTROLE DE DEVOLUÇÕES</span>
          <h2>Crie uma nova senha.</h2>
          <p>Escolha uma senha segura com pelo menos 8 caracteres.</p>
        </section>

        <section className="login-panel">
          <h3>Nova senha</h3>
          <form onSubmit={atualizarSenha}>
            <label htmlFor="senhaNova">Nova senha</label>
            <input
              id="senhaNova"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              required
            />

            {erro && <p className="error-message">{erro}</p>}
            {sucesso && <p className="success-message">{sucesso}</p>}

            <button className="login-button" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  if (usuario && !perfil) {
    return (
      <main className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">PM</div>
            <div>
              <h1>P. MELLO</h1>
              <span>TRANSPORTES</span>
            </div>
          </div>
          <button className="logout" onClick={sair}>Sair</button>
        </header>

        <section className="welcome">
          <span className="eyebrow">CADASTRO EM ANÁLISE</span>
          <h2>Aguardando aprovação.</h2>
          <p>
            Sua conta ainda não tem acesso à operação. Aguarde a liberação
            do administrador da P. MELLO Transportes.
          </p>

          {erro && <p className="error-message">{erro}</p>}

          <button
            className="login-button"
            onClick={() => carregarPerfil({ user: usuario })}
          >
            Verificar meu acesso novamente
          </button>
        </section>
      </main>
    )
  }

  if (usuario && perfil) {
    const nomePerfil =
      perfil.perfil === 'admin'
        ? 'Administrador'
        : perfil.perfil === 'base'
          ? 'Equipe da base'
          : 'Entregador'

    const podeRegistrar = perfil.perfil === 'entregador'
    const podeConferir = ['base', 'admin'].includes(perfil.perfil)
    const ehAdmin = perfil.perfil === 'admin'

    const menu = [
      { id: 'inicio', titulo: 'Visão geral', icone: '⌂' },
      ...(podeRegistrar
        ? [{ id: 'registrar', titulo: 'Registrar devolução', icone: '+' }]
        : []),
      ...(podeConferir
        ? [{ id: 'central', titulo: 'Central de devoluções', icone: '▤' }]
        : []),
      { id: 'historico', titulo: 'Histórico de devoluções', icone: '◷' },
      ...(ehAdmin
        ? [
            { id: 'relatorios', titulo: 'Relatórios e indicadores', icone: '▥' },
            { id: 'configuracoes', titulo: 'Configurações', icone: '⚙' },
          ]
        : []),
    ]

    const paginaPermitida = menu.some((item) => item.id === paginaAtiva)
    const paginaAtual = paginaPermitida ? paginaAtiva : 'inicio'

    const tituloPagina =
      menu.find((item) => item.id === paginaAtual)?.titulo || 'Visão geral'

    const listaHistorico = devolucoesFiltradas.filter((item) =>
      paginaAtual === 'central' ? item.status !== 'recebido' : true
    )

    const maiorVolumeCidade = Math.max(
      1,
      ...dadosPorCidade.map((item) => item[1])
    )

    const maiorVolumeMotivo = Math.max(
      1,
      ...dadosPorMotivo.map((item) => item[1])
    )

    return (
      <main className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-mark">PM</div>
            <div>
              <h1>P. MELLO</h1>
              <span>TRANSPORTES</span>
            </div>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar">
              {(perfil.nome || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{perfil.nome}</strong>
              <small>{nomePerfil}</small>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Navegação principal">
            <span className="nav-caption">MENU PRINCIPAL</span>

            {menu.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`menu-button ${paginaAtual === item.id ? 'active' : ''}`}
                onClick={() => {
                  pararCamera()
                  setPaginaAtiva(item.id)
                  setErro('')
                  setSucesso('')
                }}
              >
                <span className="menu-icon">{item.icone}</span>
                {item.titulo}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-status">
              <span className="status-dot" />
              Sistema operacional
            </div>
            <button className="sidebar-logout" onClick={sair} type="button">
              Sair da conta
            </button>
          </div>
        </aside>

        <section className="dashboard-main">
          <header className="dashboard-topbar">
            <div>
              <span className="eyebrow">P. MELLO TRANSPORTES</span>
              <h2>{tituloPagina}</h2>
            </div>
            <div className="topbar-user">
              <span>{perfil.nome}</span>
              <div className="user-avatar small">
                {(perfil.nome || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          <div className="dashboard-content">
            {erro && <p className="error-message">{erro}</p>}
            {sucesso && <p className="success-message">{sucesso}</p>}

            {paginaAtual === 'inicio' && (
              <>
                <section className="dashboard-heading">
                  <div>
                    <span className="eyebrow">
                      {ehAdmin ? 'PAINEL DE GESTÃO' : podeConferir ? 'PAINEL DA BASE' : 'PAINEL DO ENTREGADOR'}
                    </span>
                    <h3>Olá, {perfil.nome}!</h3>
                    <p>
                      {ehAdmin
                        ? 'Acompanhe os indicadores e a movimentação geral das devoluções.'
                        : podeConferir
                          ? 'Acompanhe os pacotes que aguardam conferência física.'
                          : 'Acompanhe suas devoluções registradas e seus respectivos status.'}
                    </p>
                  </div>

                  <button
                    className="refresh-button"
                    type="button"
                    disabled={atualizando}
                    onClick={atualizarDados}
                  >
                    {atualizando ? 'Atualizando...' : '↻ Atualizar dados'}
                  </button>
                </section>

                <section className="dashboard-cards">
                  <article className="metric-card">
                    <span className="metric-label">Total de devoluções</span>
                    <strong>{totalDevolucoes}</strong>
                    <small>Registros disponíveis no seu perfil</small>
                  </article>

                  <article className="metric-card warning">
                    <span className="metric-label">Aguardando recebimento</span>
                    <strong>{aguardandoRecebimento}</strong>
                    <small>Pendentes de conferência pela base</small>
                  </article>

                  <article className="metric-card success">
                    <span className="metric-label">Recebidas pela base</span>
                    <strong>{recebidas}</strong>
                    <small>Recebimento físico confirmado</small>
                  </article>

                  {podeConferir && (
                    <article className="metric-card">
                      <span className="metric-label">Cadastros pendentes</span>
                      <strong>{pendentes.length}</strong>
                      <small>Aguardando aprovação de acesso</small>
                    </article>
                  )}
                </section>

                {ehAdmin && (
                  <section className="content-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Distribuição por cidade</h3>
                        <p>Volume de devoluções nos registros disponíveis.</p>
                      </div>
                    </div>

                    {dadosPorCidade.length === 0 ? (
                      <p className="notice">Ainda não existem dados para apresentar.</p>
                    ) : (
                      <div className="report-bars">
                        {dadosPorCidade.map(([cidade, quantidade]) => (
                          <div className="report-bar-row" key={cidade}>
                            <div className="report-bar-info">
                              <span>{cidade}</span>
                              <strong>{quantidade}</strong>
                            </div>
                            <div className="report-bar-track">
                              <div
                                className="report-bar-fill"
                                style={{
                                  width: `${(quantidade / maiorVolumeCidade) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Movimentações recentes</h3>
                      <p>Últimas devoluções registradas no sistema.</p>
                    </div>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setPaginaAtiva('historico')}
                    >
                      Ver histórico
                    </button>
                  </div>

                  {devolucoes.length === 0 ? (
                    <p className="notice">Nenhuma devolução encontrada até o momento.</p>
                  ) : (
                    devolucoes.slice(0, 5).map((item) => (
                      <article className="return-row" key={item.id}>
                        <div className="return-main">
                          <strong>{item.codigo_rastreio}</strong>
                          <span>
                            {nomesCidades[item.cidade_id] || 'Cidade não identificada'}
                            {' · '}
                            {item.motivo}
                          </span>
                        </div>
                        <span className={`return-status ${item.status === 'recebido' ? 'received' : 'pending'}`}>
                          {item.status === 'recebido' ? 'Recebido' : 'Pendente'}
                        </span>
                      </article>
                    ))
                  )}
                </section>

                {podeConferir && (
                  <section className="content-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Solicitações de acesso</h3>
                        <p>Cadastros que aguardam aprovação da equipe responsável.</p>
                      </div>
                      <span className="count-pill">{pendentes.length} pendente(s)</span>
                    </div>

                    {pendentes.length === 0 ? (
                      <p className="notice">Nenhum cadastro pendente.</p>
                    ) : (
                      pendentes.map((item) => (
                        <article className="action-card" key={item.id}>
                          <span className="action-icon">?</span>
                          <span className="action-text">
                            <strong>{item.nome}</strong>
                            <small>{item.email}</small>
                            <small>Solicitado em: {formatarData(item.criado_em)}</small>
                            <label htmlFor={`perfil-${item.id}`}>Perfil para liberar</label>
                            <select
                              id={`perfil-${item.id}`}
                              value={perfisEscolhidos[item.id] || 'entregador'}
                              onChange={(e) =>
                                setPerfisEscolhidos((anterior) => ({
                                  ...anterior,
                                  [item.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="entregador">Entregador</option>
                              <option value="base">Equipe da base</option>
                            </select>
                            <button
                              className="login-button"
                              disabled={enviando || rejeitandoId !== null}
                              onClick={() => aprovarUsuario(item.id)}
                              type="button"
                            >
                              {enviando ? 'Aprovando...' : 'Aprovar acesso'}
                            </button>
                            <button
                              className="logout"
                              style={{
                                width: '100%',
                                marginTop: '8px',
                                borderColor: '#dc5555',
                                color: '#ff7777',
                              }}
                              disabled={enviando || rejeitandoId !== null}
                              onClick={() => rejeitarUsuario(item.id, item.nome)}
                              type="button"
                            >
                              {rejeitandoId === item.id ? 'Rejeitando...' : 'Rejeitar cadastro'}
                            </button>
                          </span>
                        </article>
                      ))
                    )}
                  </section>
                )}
              </>
            )}

            {paginaAtual === 'registrar' && podeRegistrar && (
              <section className="content-panel form-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Registrar devolução</h3>
                    <p>Informe os dados do pacote para registrar a devolução.</p>
                  </div>
                </div>

                <form onSubmit={registrarDevolucao}>
                  <label htmlFor="codigo">Código de rastreio</label>

                  <input
                    id="codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Digite ou escaneie o código"
                    autoComplete="off"
                    required
                  />

                  <button
                    type="button"
                    className="refresh-button"
                    onClick={cameraAtiva ? pararCamera : iniciarCamera}
                    disabled={iniciandoCameraRef.current}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      marginBottom: '15px',
                    }}
                  >
                    {cameraAtiva
                      ? '✕ Fechar câmera'
                      : iniciandoCameraRef.current
                        ? 'Solicitando acesso à câmera...'
                        : '▣ Ler código pela câmera'}
                  </button>

                  <div
                    style={{
                      display: cameraAtiva ? 'block' : 'none',
                      width: '100%',
                      marginBottom: '18px',
                      background: '#000',
                      borderRadius: '12px',
                      overflow: 'hidden',
                    }}
                  >
                    <video
                      ref={videoRef}
                      muted
                      playsInline
                      autoPlay
                      style={{
                        width: '100%',
                        maxHeight: '320px',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    <p
                      style={{
                        color: '#ffd400',
                        textAlign: 'center',
                        padding: '10px',
                        margin: 0,
                        fontSize: '13px',
                      }}
                    >
                      Aponte a câmera para o código de barras ou QR Code do pacote.
                    </p>
                  </div>

                  <label htmlFor="cidade">Cidade</label>
                  <select
                    id="cidade"
                    value={cidadeId}
                    onChange={(e) => setCidadeId(e.target.value)}
                    required
                  >
                    <option value="">Selecione a cidade</option>
                    {cidades.map((cidade) => (
                      <option key={cidade.id} value={cidade.id}>
                        {cidade.nome}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="motivo">Motivo da devolução</label>
                  <select
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    required
                  >
                    <option value="">Selecione o motivo</option>
                    {motivos.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>

                  {motivo === 'Outro' && (
                    <>
                      <label htmlFor="detalhes">Descreva o motivo</label>
                      <textarea
                        id="detalhes"
                        value={detalhes}
                        onChange={(e) => setDetalhes(e.target.value)}
                        placeholder="Explique o motivo da devolução"
                        required
                      />
                    </>
                  )}

                  <button className="login-button" type="submit" disabled={enviando}>
                    {enviando ? 'Registrando...' : 'Registrar devolução'}
                  </button>
                </form>
              </section>
            )}

            {(paginaAtual === 'central' || paginaAtual === 'historico') && (
              <section className="content-panel">
                <div className="panel-heading">
                  <div>
                    <h3>
                      {paginaAtual === 'central'
                        ? 'Devoluções aguardando conferência'
                        : 'Histórico de devoluções'}
                    </h3>
                    <p>{listaHistorico.length} registro(s) encontrado(s).</p>
                  </div>

                  <button
                    className="refresh-button"
                    type="button"
                    disabled={atualizando}
                    onClick={atualizarDados}
                  >
                    {atualizando ? 'Atualizando...' : '↻ Atualizar'}
                  </button>
                </div>

                <div className="history-filters">
                  <input
                    type="search"
                    placeholder="Pesquisar código ou entregador..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />

                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                  >
                    <option value="todos">Todos os status</option>
                    <option value="pendente">Aguardando recebimento</option>
                    <option value="recebido">Recebidos</option>
                  </select>

                  <select
                    value={filtroCidade}
                    onChange={(e) => setFiltroCidade(e.target.value)}
                  >
                    <option value="todas">Todas as cidades</option>
                    {cidades.map((cidade) => (
                      <option key={cidade.id} value={cidade.id}>{cidade.nome}</option>
                    ))}
                  </select>

                  <select
                    value={filtroMotivo}
                    onChange={(e) => setFiltroMotivo(e.target.value)}
                  >
                    <option value="todos">Todos os motivos</option>
                    {motivos.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                {listaHistorico.length === 0 ? (
                  <p className="notice">Nenhuma devolução encontrada com os filtros selecionados.</p>
                ) : (
                  listaHistorico.map((item) => (
                    <article className="return-detail-card" key={item.id}>
                      <div className="return-detail-heading">
                        <strong>{item.codigo_rastreio}</strong>
                        <span className={`return-status ${item.status === 'recebido' ? 'received' : 'pending'}`}>
                          {item.status === 'recebido' ? 'Recebido pela base' : 'Aguardando recebimento'}
                        </span>
                      </div>

                      <div className="return-detail-grid">
                        <span>
                          <small>Entregador</small>
                          {nomesEntregadores[item.entregador_id] || 'Nome não identificado'}
                        </span>
                        <span>
                          <small>Cidade</small>
                          {nomesCidades[item.cidade_id] || 'Não identificada'}
                        </span>
                        <span>
                          <small>Motivo</small>
                          {item.motivo}
                        </span>
                        <span>
                          <small>Registrado em</small>
                          {formatarData(item.criado_em)}
                        </span>
                      </div>

                      {item.detalhes_motivo && (
                        <p className="notice">Detalhes: {item.detalhes_motivo}</p>
                      )}

                      {item.status !== 'recebido' && podeConferir && (
                        <button
                          className="login-button"
                          type="button"
                          disabled={recebendoId !== null}
                          onClick={() => confirmarRecebimento(item.id)}
                        >
                          {recebendoId === item.id ? 'Confirmando...' : 'Confirmar recebimento físico'}
                        </button>
                      )}

                      {item.status === 'recebido' && (
                        <small className="received-date">
                          Recebido em: {formatarData(item.recebido_em)}
                        </small>
                      )}
                    </article>
                  ))
                )}
              </section>
            )}

            {paginaAtual === 'relatorios' && ehAdmin && (
              <>
                <section className="dashboard-heading">
                  <div>
                    <span className="eyebrow">ACOMPANHAMENTO</span>
                    <h3>Relatórios e indicadores</h3>
                    <p>Análise dos registros disponíveis no sistema.</p>
                  </div>

                  <button
                    className="refresh-button"
                    type="button"
                    disabled={atualizando}
                    onClick={atualizarDados}
                  >
                    {atualizando ? 'Atualizando...' : '↻ Atualizar dados'}
                  </button>
                </section>

                <section className="dashboard-cards">
                  <article className="metric-card">
                    <span className="metric-label">Registros no histórico</span>
                    <strong>{totalDevolucoes}</strong>
                    <small>Até 200 registros mais recentes</small>
                  </article>
                  <article className="metric-card warning">
                    <span className="metric-label">Pendentes</span>
                    <strong>{aguardandoRecebimento}</strong>
                    <small>Aguardando confirmação da base</small>
                  </article>
                  <article className="metric-card success">
                    <span className="metric-label">Concluídas</span>
                    <strong>{recebidas}</strong>
                    <small>Recebimento confirmado</small>
                  </article>
                </section>

                <section className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Devoluções por cidade</h3>
                      <p>Distribuição dos registros por localidade.</p>
                    </div>
                  </div>

                  {dadosPorCidade.length === 0 ? (
                    <p className="notice">Sem dados disponíveis.</p>
                  ) : (
                    <div className="report-bars">
                      {dadosPorCidade.map(([cidade, quantidade]) => (
                        <div className="report-bar-row" key={cidade}>
                          <div className="report-bar-info">
                            <span>{cidade}</span>
                            <strong>{quantidade}</strong>
                          </div>
                          <div className="report-bar-track">
                            <div
                              className="report-bar-fill"
                              style={{ width: `${(quantidade / maiorVolumeCidade) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Devoluções por motivo</h3>
                      <p>Principais motivos registrados pela equipe.</p>
                    </div>
                  </div>

                  {dadosPorMotivo.length === 0 ? (
                    <p className="notice">Sem dados disponíveis.</p>
                  ) : (
                    <div className="report-bars">
                      {dadosPorMotivo.map(([nomeMotivo, quantidade]) => (
                        <div className="report-bar-row" key={nomeMotivo}>
                          <div className="report-bar-info">
                            <span>{nomeMotivo}</span>
                            <strong>{quantidade}</strong>
                          </div>
                          <div className="report-bar-track">
                            <div
                              className="report-bar-fill"
                              style={{ width: `${(quantidade / maiorVolumeMotivo) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="content-panel">
                  <h3>Limite dos indicadores</h3>
                  <p className="notice">
                    Os relatórios são calculados com base nos registros que o sistema
                    disponibiliza para seu perfil, limitados aos 200 registros mais
                    recentes. Eles não representam volume total da operação fora do aplicativo.
                  </p>
                </section>
              </>
            )}

            {paginaAtual === 'configuracoes' && ehAdmin && (
              <>
                <section className="content-panel">
                  <h3>Configurações da conta</h3>
                  <div className="settings-row">
                    <span><small>Nome</small>{perfil.nome}</span>
                    <span><small>E-mail</small>{usuario.email}</span>
                    <span><small>Perfil de acesso</small>{nomePerfil}</span>
                  </div>
                </section>

                <section className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Solicitações de acesso</h3>
                      <p>Gerencie os novos cadastros da equipe.</p>
                    </div>
                    <button
                      className="refresh-button"
                      type="button"
                      onClick={carregarPendentes}
                    >
                      Atualizar
                    </button>
                  </div>

                  {pendentes.length === 0 ? (
                    <p className="notice">Nenhum cadastro pendente.</p>
                  ) : (
                    pendentes.map((item) => (
                      <article className="action-card" key={item.id}>
                        <span className="action-icon">?</span>
                        <span className="action-text">
                          <strong>{item.nome}</strong>
                          <small>{item.email}</small>
                          <small>Solicitado em: {formatarData(item.criado_em)}</small>

                          <label htmlFor={`perfil-config-${item.id}`}>Perfil para liberar</label>
                          <select
                            id={`perfil-config-${item.id}`}
                            value={perfisEscolhidos[item.id] || 'entregador'}
                            onChange={(e) =>
                              setPerfisEscolhidos((anterior) => ({
                                ...anterior,
                                [item.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="entregador">Entregador</option>
                            <option value="base">Equipe da base</option>
                          </select>

                          <button
                            className="login-button"
                            disabled={enviando || rejeitandoId !== null}
                            onClick={() => aprovarUsuario(item.id)}
                            type="button"
                          >
                            {enviando ? 'Aprovando...' : 'Aprovar acesso'}
                          </button>
                          <button
                            className="logout"
                            style={{
                              width: '100%',
                              marginTop: '8px',
                              borderColor: '#dc5555',
                              color: '#ff7777',
                            }}
                            disabled={enviando || rejeitandoId !== null}
                            onClick={() => rejeitarUsuario(item.id, item.nome)}
                            type="button"
                          >
                            {rejeitandoId === item.id ? 'Rejeitando...' : 'Rejeitar cadastro'}
                          </button>
                        </span>
                      </article>
                    ))
                  )}
                </section>
              </>
            )}

            <footer className="dashboard-footer">
              <span>P. MELLO TRANSPORTES</span>
              <span>CONTROLE • RASTREABILIDADE • RESULTADO</span>
            </footer>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">PM</div>
          <div>
            <h1>P. MELLO</h1>
            <span>TRANSPORTES</span>
          </div>
        </div>
        <span className="status">ACESSO RESTRITO</span>
      </header>

      <section className="welcome">
        <span className="eyebrow">CONTROLE DE DEVOLUÇÕES</span>
        <h2>Bem-vindo<br />à operação.</h2>
        <p>
          Entre com seu e-mail e senha para acessar o sistema de devoluções.
        </p>
      </section>

      <section className="login-panel">
        {modo === 'login' && (
          <>
            <h3>Entrar no sistema</h3>
            <form onSubmit={entrar}>
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '-10px',
                marginBottom: '18px',
              }}>
                <button
                  type="button"
                  onClick={() => mudarModo('recuperar')}
                  style={{
                    background: 'none',
                    border: 0,
                    color: '#ffd400',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>

              {erro && <p className="error-message">{erro}</p>}
              {sucesso && <p className="success-message">{sucesso}</p>}

              <button className="login-button" type="submit" disabled={enviando}>
                {enviando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="notice" style={{ textAlign: 'center', marginTop: '22px' }}>
              Ainda não tem acesso?
            </p>

            <button
              className="logout"
              style={{ width: '100%' }}
              onClick={() => mudarModo('cadastro')}
            >
              Criar minha conta
            </button>
          </>
        )}

        {modo === 'cadastro' && (
          <>
            <h3>Solicitar acesso</h3>
            <p className="notice">
              Preencha seus dados. O acesso à operação depende da aprovação
              da equipe responsável.
            </p>

            <form onSubmit={cadastrar}>
              <label htmlFor="nome">Nome completo</label>
              <input
                id="nome"
                autoComplete="name"
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />

              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="senha">Criar senha</label>
              <input
                id="senha"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder="Mínimo de 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />

              {erro && <p className="error-message">{erro}</p>}
              {sucesso && <p className="success-message">{sucesso}</p>}

              <button className="login-button" type="submit" disabled={enviando}>
                {enviando ? 'Enviando solicitação...' : 'Solicitar cadastro'}
              </button>
            </form>

            <button
              className="logout"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => mudarModo('login')}
            >
              Voltar para entrar
            </button>
          </>
        )}

        {modo === 'recuperar' && (
          <>
            <h3>Recuperar senha</h3>
            <p className="notice">
              Informe seu e-mail cadastrado. Se a conta existir, enviaremos
              um link de redefinição.
            </p>

            <form onSubmit={recuperarSenha}>
              <label htmlFor="email">E-mail cadastrado</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {erro && <p className="error-message">{erro}</p>}
              {sucesso && <p className="success-message">{sucesso}</p>}

              <button className="login-button" type="submit" disabled={enviando}>
                {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>

            <button
              className="logout"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => mudarModo('login')}
            >
              Voltar para entrar
            </button>
          </>
        )}
      </section>

      <footer>
        <span>P. MELLO TRANSPORTES</span>
        <span>CONTROLE • RASTREABILIDADE • RESULTADO</span>
      </footer>
    </main>
  )
}

export default App