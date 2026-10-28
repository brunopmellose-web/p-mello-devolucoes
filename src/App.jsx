
import { useCallback, useEffect, useState } from 'react'
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

function App() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [modo, setModo] = useState('login')
  const [cidades, setCidades] = useState([])
  const [devolucoes, setDevolucoes] = useState([])
  const [pendentes, setPendentes] = useState([])
  const [perfisEscolhidos, setPerfisEscolhidos] = useState({})
  const [codigo, setCodigo] = useState('')
  const [cidadeId, setCidadeId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalhes, setDetalhes] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [sessaoRecuperacao, setSessaoRecuperacao] = useState(false)

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

        // Evita consultar o banco diretamente dentro do evento de autenticação.
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

      if (perfil.perfil === 'admin') {
        await carregarPendentes()
      }
    }

    carregarDados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, perfil])

  async function carregarDevolucoes() {
    const { data, error } = await supabase
      .from('returns')
      .select(
        'id, codigo_rastreio, cidade_id, motivo, detalhes_motivo, status, criado_em'
      )
      .order('criado_em', { ascending: false })
      .limit(200)

    if (error) {
      setErro('Não foi possível carregar as devoluções. Verifique as permissões do banco.')
      return
    }

    setDevolucoes(data || [])
  }

  async function carregarPendentes() {
    const { data, error } = await supabase.rpc(
      'listar_cadastros_pendentes'
    )

    if (error) {
      setErro(
        'Não foi possível consultar os cadastros pendentes. Confirme as funções de aprovação no Supabase.'
      )
      return
    }

    setPendentes(data || [])
  }

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

    // Se o Supabase criar uma sessão automaticamente, encerra-a.
    // O usuário precisa aguardar a aprovação para entrar na operação.
    if (data.session) {
      await supabase.auth.signOut()
    }

    setSenha('')
    setNome('')
    setModo('login')
    setSucesso(
      'Solicitação enviada! Confirme seu e-mail, se solicitado, e aguarde a aprovação do administrador.'
    )
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
      {
        redirectTo: window.location.origin,
      }
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

    setSucesso(
      'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. Confira também o spam.'
    )
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
      setErro(
        'Não foi possível atualizar a senha. Solicite um novo link de recuperação.'
      )
      return
    }

    setSenhaNova('')
    setSessaoRecuperacao(false)
    setModo('login')
    setSucesso('Senha atualizada com sucesso! Entre com sua nova senha.')

    await supabase.auth.signOut()
  }

  async function sair() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setErro('Não foi possível encerrar a sessão.')
    } else {
      setPerfil(null)
      setUsuario(null)
      setModo('login')
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
      setErro(
        'Não foi possível aprovar o cadastro. Confirme se sua conta é um administrador ativo.'
      )
      return
    }

    setSucesso('Cadastro aprovado com sucesso.')
    await carregarPendentes()
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

  if (carregando) {
    return (
      <main className="app">
        <p>Carregando aplicativo...</p>
      </main>
    )
  }

  // Tela de redefinição aberta pelo link enviado por e-mail.
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

  // Conta autenticada, mas ainda não aprovada.
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

    const nomesCidades = Object.fromEntries(
      cidades.map((cidade) => [cidade.id, cidade.nome])
    )

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
          <span className="eyebrow">CONTROLE DE DEVOLUÇÕES</span>
          <h2>Olá, {perfil.nome}!</h2>
          <p>Acesso: {nomePerfil}</p>
        </section>

        {perfil.perfil === 'admin' && (
          <section className="login-panel">
            <h3>Solicitações de acesso</h3>
            <p className="notice">
              Aprove os cadastros e escolha o perfil autorizado. Esta tela
              não permite criar novos administradores.
            </p>

            {pendentes.length === 0 ? (
              <p className="notice">Nenhum cadastro pendente.</p>
            ) : (
              pendentes.map((item) => (
                <article className="action-card" key={item.id}>
                  <span className="action-icon">?</span>
                  <span className="action-text">
                    <strong>{item.nome}</strong>
                    <small>{item.email}</small>
                    <small>
                      Solicitado em:{' '}
                      {new Date(item.criado_em).toLocaleString('pt-BR')}
                    </small>

                    <label htmlFor={`perfil-${item.id}`}>
                      Perfil para liberar
                    </label>
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
                      disabled={enviando}
                      onClick={() => aprovarUsuario(item.id)}
                    >
                      {enviando ? 'Aprovando...' : 'Aprovar acesso'}
                    </button>
                  </span>
                </article>
              ))
            )}

            <button className="logout" onClick={carregarPendentes}>
              Atualizar solicitações
            </button>
          </section>
        )}

        {perfil.perfil === 'entregador' && (
          <section className="login-panel">
            <h3>Registrar devolução</h3>

            <form onSubmit={registrarDevolucao}>
              <label htmlFor="codigo">Código de rastreio</label>
              <input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Digite ou escaneie o código"
                required
              />

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

              {erro && <p className="error-message">{erro}</p>}
              {sucesso && <p className="success-message">{sucesso}</p>}

              <button
                className="login-button"
                type="submit"
                disabled={enviando}
              >
                {enviando ? 'Registrando...' : 'Registrar devolução'}
              </button>
            </form>
          </section>
        )}

        <section className="actions">
          <h3>
            {perfil.perfil === 'base'
              ? 'Devoluções para conferência'
              : 'Histórico de devoluções'}
          </h3>

          <p className="notice">
            {devolucoes.length} registro(s) disponível(is) conforme as
            permissões do seu perfil.
          </p>

          {devolucoes.length === 0 ? (
            <p className="notice">
              Nenhuma devolução encontrada até o momento.
            </p>
          ) : (
            devolucoes.map((item) => (
              <article className="action-card" key={item.id}>
                <span className="action-icon">
                  {item.status === 'recebido' ? '✓' : '…'}
                </span>
                <span className="action-text">
                  <strong>{item.codigo_rastreio}</strong>
                  <small>
                    Cidade: {nomesCidades[item.cidade_id] || 'Não identificada'}
                  </small>
                  <small>Motivo: {item.motivo}</small>

                  {item.detalhes_motivo && (
                    <small>Detalhes: {item.detalhes_motivo}</small>
                  )}

                  <small>
                    Status:{' '}
                    {item.status === 'recebido'
                      ? 'Recebido pela base'
                      : 'Aguardando recebimento'}
                  </small>
                  <small>
                    Data: {new Date(item.criado_em).toLocaleString('pt-BR')}
                  </small>
                </span>
              </article>
            ))
          )}

          <button className="logout" onClick={carregarDevolucoes}>
            Atualizar histórico
          </button>
        </section>

        {erro && <p className="error-message">{erro}</p>}
        {sucesso && <p className="success-message">{sucesso}</p>}

        <footer>
          <span>P. MELLO TRANSPORTES</span>
          <span>CONTROLE • RASTREABILIDADE • RESULTADO</span>
        </footer>
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

              <button
                className="login-button"
                type="submit"
                disabled={enviando}
              >
                {enviando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="notice" style={{
              textAlign: 'center',
              marginTop: '22px',
            }}>
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
              do administrador.
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

              <button
                className="login-button"
                type="submit"
                disabled={enviando}
              >
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

              <button
                className="login-button"
                type="submit"
                disabled={enviando}
              >
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
