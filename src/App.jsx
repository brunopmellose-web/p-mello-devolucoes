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

function DistribuicaoCidades({ dados }) {
  const maiorVolume = Math.max(1, ...dados.map((item) => item.total))

  return (
    <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
      {dados.length === 0 ? (
        <p className="notice">Nenhuma cidade cadastrada.</p>
      ) : (
        dados.map((item) => (
          <div key={item.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px',
                flexWrap: 'wrap',
              }}
            >
              <strong style={{ fontSize: '14px' }}>{item.nome}</strong>
              <strong style={{ fontSize: '15px', color: '#ffd400' }}>
                {item.total} devoluções
              </strong>
            </div>

            <div
              style={{
                height: '12px',
                width: '100%',
                background: '#292929',
                borderRadius: '20px',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              {item.recebidas > 0 && (
                <div
                  style={{
                    width: `${(item.recebidas / maiorVolume) * 100}%`,
                    background: '#22c55e',
                    height: '100%',
                  }}
                />
              )}

              {item.pendentes > 0 && (
                <div
                  style={{
                    width: `${(item.pendentes / maiorVolume) * 100}%`,
                    background: '#ffd400',
                    height: '100%',
                  }}
                />
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '8px',
                fontSize: '12px',
                color: '#aaa',
              }}
            >
              <span>
                <span style={{ color: '#22c55e' }}>●</span> {item.recebidas} recebidas
              </span>
              <span>
                <span style={{ color: '#ffd400' }}>●</span> {item.pendentes} pendentes
              </span>
              <strong style={{ color: '#fff' }}>
                {item.percentual}% concluído
              </strong>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DistribuicaoMotivos({ dados }) {
  const maiorVolume = Math.max(1, ...dados.map((item) => item[1]))

  return (
    <div
      style={{
        display: 'grid',
        gap: '22px',
        marginTop: '24px',
        width: '100%',
      }}
    >
      {dados.length === 0 ? (
        <p className="notice">Nenhum motivo registrado.</p>
      ) : (
        dados.map(([nomeMotivo, quantidade]) => {
          const percentual = (quantidade / maiorVolume) * 100

          return (
            <div
              key={nomeMotivo}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '9px',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: '#f5f5f5', fontSize: '14px', fontWeight: 500 }}>
                  {nomeMotivo}
                </span>
                <strong style={{ color: '#ffd400', fontSize: '15px' }}>
                  {quantidade} {quantidade === 1 ? 'devolução' : 'devoluções'}
                </strong>
              </div>

              <div
                style={{
                  width: '100%',
                  height: '13px',
                  background: '#292929',
                  borderRadius: '20px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percentual}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #d6a900 0%, #ffd400 100%)',
                    borderRadius: '20px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>

              <span style={{ color: '#999', fontSize: '12px', textAlign: 'right' }}>
                {Math.round(percentual)}% do maior volume
              </span>
            </div>
          )
        })
      )}
    </div>
  )
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
  const [cidadeCadastro, setCidadeCadastro] = useState('')
  const [carregandoCidades, setCarregandoCidades] = useState(true)
  const [erroCidades, setErroCidades] = useState('')
  const [devolucoes, setDevolucoes] = useState([])
  const [pendentes, setPendentes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [filtroPerfilUsuario, setFiltroPerfilUsuario] = useState('todos')
  const [filtroSituacaoUsuario, setFiltroSituacaoUsuario] = useState('todos')
  const [perfisEscolhidos, setPerfisEscolhidos] = useState({})
  const [nomesEntregadores, setNomesEntregadores] = useState({})
  const [recebendoId, setRecebendoId] = useState(null)
  const [rejeitandoId, setRejeitandoId] = useState(null)
  const [alterandoStatusId, setAlterandoStatusId] = useState(null)
  const [contaSuspensa, setContaSuspensa] = useState(false)

  // CAMPOS DO PACOTE QUE ESTÁ SENDO ADICIONADO À TAREFA
  const [codigo, setCodigo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [detalhes, setDetalhes] = useState('')

  // PACOTES QUE FORMARÃO A TAREFA
  const [pacotesTarefa, setPacotesTarefa] = useState([])

  const [senhaNova, setSenhaNova] = useState('')
  const [sessaoRecuperacao, setSessaoRecuperacao] = useState(false)
  const [paginaAtiva, setPaginaAtiva] = useState('inicio')

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroCidade, setFiltroCidade] = useState('todas')
  const [filtroMotivo, setFiltroMotivo] = useState('todos')

  const [buscaCentral, setBuscaCentral] = useState('')
  const [filtroCidadeCentral, setFiltroCidadeCentral] = useState('todas')
  const [filtroMotivoCentral, setFiltroMotivoCentral] = useState('todos')

  const [cameraAtiva, setCameraAtiva] = useState(false)
  const videoRef = useRef(null)
  const leitorRef = useRef(null)
  const controlesCameraRef = useRef(null)
  const iniciandoCameraRef = useRef(false)

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

      setCameraAtiva(true)
      await new Promise((resolve) => requestAnimationFrame(resolve))

      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()

      const leitor = new BrowserMultiFormatReader()
      leitorRef.current = leitor

      const controles = await leitor.decodeFromStream(stream, video, (resultado) => {
        if (!resultado) return

        const codigoLido = resultado.getText().trim()

        if (codigoLido) {
          setCodigo(codigoLido)
          setSucesso('Código lido com sucesso! Confira os dados antes de adicionar.')
          pararCamera()
        }
      })

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
        setErro('Permissão da câmera bloqueada. Autorize o acesso nas configurações do navegador.')
      } else if (erroCamera?.name === 'NotFoundError') {
        setErro('Nenhuma câmera foi encontrada neste celular.')
      } else if (erroCamera?.name === 'NotReadableError') {
        setErro('A câmera está sendo utilizada por outro aplicativo.')
      } else {
        setErro('Não foi possível iniciar a câmera. Verifique as permissões e tente novamente.')
      }
    } finally {
      iniciandoCameraRef.current = false
    }
  }

  useEffect(() => {
    if (paginaAtiva !== 'registrar' && cameraAtiva) {
      pararCamera()
    }
  }, [paginaAtiva, cameraAtiva, pararCamera])

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
      .select('nome, perfil, ativo, cidade_id')
      .eq('id', sessao.user.id)
      .maybeSingle()

    setUsuario(sessao.user)

    if (error) {
      setErro('Não foi possível consultar seu perfil. Verifique as permissões do Supabase.')
      setPerfil(null)
      return
    }

    if (!data) {
      setContaSuspensa(false)
      setPerfil(null)
      return
    }

    if (!data.ativo) {
      setContaSuspensa(true)
      setPerfil(null)
      setErro('Sua conta está sem acesso ativo. Aguarde a aprovação ou procure a equipe responsável.')
      return
    }

    setContaSuspensa(false)
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
        recebido_em,
        tarefa_id
      `)
      .order('criado_em', { ascending: false })
      .limit(200)

    if (error) {
      setErro(`Não foi possível carregar as devoluções: ${error.message}`)
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
      setErro('As devoluções foram carregadas, mas não foi possível consultar os nomes dos entregadores.')
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

  const carregarUsuarios = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, perfil, ativo, criado_em')
      .order('criado_em', { ascending: false })

    if (error) {
      setErro(`Não foi possível carregar os usuários: ${error.message}`)
      return
    }

    setUsuarios(data || [])
  }, [])

  const atualizarDados = useCallback(async () => {
    setAtualizando(true)
    setErro('')

    await carregarDevolucoes()

    if (['admin', 'base'].includes(perfil?.perfil)) {
      await carregarPendentes()
      await carregarUsuarios()
    }

    setAtualizando(false)
  }, [carregarDevolucoes, carregarPendentes, carregarUsuarios, perfil])

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
        setErro(`Não foi possível confirmar o recebimento: ${error.message}`)
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

    const { data: listener } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setSessaoRecuperacao(true)
        setModo('redefinir')
      }

      Promise.resolve().then(() => {
        if (ativo) carregarPerfil(sessao)
      })
    })

    return () => {
      ativo = false
      listener.subscription.unsubscribe()
    }
  }, [carregarPerfil])

  useEffect(() => {
    let ativo = true

    async function carregarCidadesPublicas() {
      setCarregandoCidades(true)
      setErroCidades('')

      const { data, error } = await supabase
        .from('cities')
        .select('id, nome')
        .eq('ativa', true)
        .order('nome')

      if (!ativo) return

      if (error) {
        setCidades([])
        setErroCidades('Não foi possível carregar a lista de cidades. Atualize a página e tente novamente.')
      } else {
        setCidades(data || [])
      }

      setCarregandoCidades(false)
    }

    carregarCidadesPublicas()

    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!usuario || !perfil) return

    async function carregarDados() {
      await carregarDevolucoes()

      if (['admin', 'base'].includes(perfil.perfil)) {
        await carregarPendentes()
        await carregarUsuarios()
      }
    }

    carregarDados()
  }, [usuario, perfil, carregarDevolucoes, carregarPendentes, carregarUsuarios])

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

    if (!cidadeCadastro) {
      setErro('Selecione a cidade onde você mora ou presta serviço.')
      return
    }

    setEnviando(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
          cidade_id: String(cidadeCadastro),
        },
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
    setCidadeCadastro('')
    setModo('login')
    setSucesso('Solicitação enviada! Confirme seu e-mail, se solicitado, e aguarde a aprovação.')
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

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })

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
      setPacotesTarefa([])
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
    await carregarUsuarios()
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
      await carregarUsuarios()
    } catch {
      setErro('Ocorreu um erro ao rejeitar o cadastro.')
    } finally {
      setRejeitandoId(null)
    }
  }

  async function alterarStatusUsuario(item) {
    const novoStatus = !item.ativo
    const acao = novoStatus ? 'reativar' : 'suspender'

    const confirmar = window.confirm(
      novoStatus
        ? `Deseja reativar a conta de ${item.nome || 'este usuário'}?`
        : `Deseja suspender a conta de ${item.nome || 'este usuário'}? O histórico operacional será mantido.`
    )

    if (!confirmar) return

    setErro('')
    setSucesso('')
    setAlterandoStatusId(item.id)

    try {
      const { error } = await supabase.rpc('alterar_status_usuario', {
        p_usuario_id: item.id,
        p_ativo: novoStatus,
      })

      if (error) {
        setErro(error.message || `Não foi possível ${acao} esta conta.`)
        return
      }

      setSucesso(novoStatus ? 'Conta reativada com sucesso!' : 'Conta suspensa com sucesso!')
      await carregarUsuarios()
    } catch {
      setErro(`Ocorreu um erro ao ${acao} esta conta.`)
    } finally {
      setAlterandoStatusId(null)
    }
  }

  // ADICIONA UM PACOTE À LISTA DA TAREFA
  function adicionarPacoteTarefa() {
    setErro('')
    setSucesso('')

    if (!codigo.trim() || !motivo) {
      setErro('Informe o código de rastreio e o motivo do pacote.')
      return
    }

    if (motivo === 'Outro' && !detalhes.trim()) {
      setErro('Explique o motivo da devolução.')
      return
    }

    const codigoNormalizado = codigo.trim()

    const jaExisteNaLista = pacotesTarefa.some(
      (item) => item.codigo_rastreio.toLowerCase() === codigoNormalizado.toLowerCase()
    )

    const jaExisteNoHistorico = devolucoes.some(
      (item) => item.codigo_rastreio.toLowerCase() === codigoNormalizado.toLowerCase()
    )

    if (jaExisteNaLista || jaExisteNoHistorico) {
      setErro('Este código de rastreio já foi adicionado ou já está registrado no sistema.')
      return
    }

    setPacotesTarefa((anterior) => [
      ...anterior,
      {
        codigo_rastreio: codigoNormalizado,
        motivo,
        detalhes_motivo: motivo === 'Outro' ? detalhes.trim() : null,
      },
    ])

    setCodigo('')
    setMotivo('')
    setDetalhes('')
    setSucesso('Pacote adicionado à tarefa. Você pode incluir outros pacotes.')
  }

  function removerPacoteTarefa(indice) {
    setPacotesTarefa((anterior) => anterior.filter((_, index) => index !== indice))
    setSucesso('Pacote removido da lista.')
    setErro('')
  }

  // CRIA UMA TAREFA COM TODOS OS PACOTES ADICIONADOS
  async function registrarDevolucao(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!perfil?.cidade_id) {
      setErro('Seu usuário ainda não possui uma cidade vinculada. Solicite ao administrador que configure sua cidade no cadastro.')
      return
    }

    let pacotesParaEnviar = [...pacotesTarefa]

    // Se houver um pacote preenchido no formulário, ele também entra na tarefa.
    if (codigo.trim() || motivo || detalhes.trim()) {
      if (!codigo.trim() || !motivo) {
        setErro('Complete o código e o motivo do pacote atual ou adicione-o à lista antes de criar a tarefa.')
        return
      }

      if (motivo === 'Outro' && !detalhes.trim()) {
        setErro('Explique o motivo da devolução.')
        return
      }

      const codigoNormalizado = codigo.trim()

      const duplicadoNaLista = pacotesParaEnviar.some(
        (item) => item.codigo_rastreio.toLowerCase() === codigoNormalizado.toLowerCase()
      )

      const duplicadoNoHistorico = devolucoes.some(
        (item) => item.codigo_rastreio.toLowerCase() === codigoNormalizado.toLowerCase()
      )

      if (duplicadoNaLista || duplicadoNoHistorico) {
        setErro('Este código de rastreio já foi adicionado ou já está registrado no sistema.')
        return
      }

      pacotesParaEnviar.push({
        codigo_rastreio: codigoNormalizado,
        motivo,
        detalhes_motivo: motivo === 'Outro' ? detalhes.trim() : null,
      })
    }

    if (pacotesParaEnviar.length === 0) {
      setErro('Adicione pelo menos um pacote antes de criar a tarefa.')
      return
    }

    const codigos = pacotesParaEnviar.map((item) =>
      item.codigo_rastreio.toLowerCase()
    )

    if (new Set(codigos).size !== codigos.length) {
      setErro('Existem códigos repetidos na lista. Revise os pacotes antes de continuar.')
      return
    }

    const confirmar = window.confirm(
      `Confirma a criação de uma tarefa com ${pacotesParaEnviar.length} pacote(s)?`
    )

    if (!confirmar) return

    setEnviando(true)

    try {
      const { data, error } = await supabase.rpc('criar_tarefa_devolucao', {
        p_pacotes: pacotesParaEnviar,
      })

      if (error) {
        if (error.code === '23505') {
          setErro('Um ou mais códigos de rastreio já estão cadastrados. Confira os pacotes.')
        } else {
          setErro(`Não foi possível criar a tarefa: ${error.message}`)
        }
        return
      }

      setPacotesTarefa([])
      setCodigo('')
      setMotivo('')
      setDetalhes('')

      setSucesso(
        `Tarefa criada com sucesso! ${pacotesParaEnviar.length} pacote(s) registrado(s). Identificador: ${String(data).slice(0, 8).toUpperCase()}`
      )

      await carregarDevolucoes()
    } catch (erroRegistro) {
      setErro(`Ocorreu um erro ao criar a tarefa: ${erroRegistro.message || 'Tente novamente.'}`)
    } finally {
      setEnviando(false)
    }
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
    const normalizar = (valor) =>
      String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()

    const termo = normalizar(busca)

    return devolucoes.filter((item) => {
      const codigoItem = normalizar(item.codigo_rastreio)
      const entregador = normalizar(nomesEntregadores[item.entregador_id])
      const cidade = normalizar(nomesCidades[item.cidade_id])
      const motivoItem = normalizar(item.motivo)

      const correspondeBusca =
        !termo ||
        codigoItem.includes(termo) ||
        entregador.includes(termo) ||
        cidade.includes(termo) ||
        motivoItem.includes(termo) ||
        String(item.tarefa_id || '').toLowerCase().includes(termo)

      const correspondeStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'pendente' && item.status !== 'recebido') ||
        (filtroStatus === 'recebido' && item.status === 'recebido')

      const correspondeCidade =
        filtroCidade === 'todas' ||
        String(item.cidade_id) === String(filtroCidade)

      const correspondeMotivo =
        filtroMotivo === 'todos' ||
        normalizar(item.motivo) === normalizar(filtroMotivo)

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
    nomesCidades,
  ])

  const devolucoesCentralFiltradas = useMemo(() => {
    const normalizar = (valor) =>
      String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()

    const termo = normalizar(buscaCentral)

    return devolucoes.filter((item) => {
      if (item.status === 'recebido') return false

      const codigoItem = normalizar(item.codigo_rastreio)
      const entregador = normalizar(nomesEntregadores[item.entregador_id])
      const cidade = normalizar(nomesCidades[item.cidade_id])
      const motivoItem = normalizar(item.motivo)

      const correspondeBusca =
        !termo ||
        codigoItem.includes(termo) ||
        entregador.includes(termo) ||
        cidade.includes(termo) ||
        motivoItem.includes(termo) ||
        String(item.tarefa_id || '').toLowerCase().includes(termo)

      const correspondeCidade =
        filtroCidadeCentral === 'todas' ||
        String(item.cidade_id) === String(filtroCidadeCentral)

      const correspondeMotivo =
        filtroMotivoCentral === 'todos' ||
        motivoItem === normalizar(filtroMotivoCentral)

      return correspondeBusca && correspondeCidade && correspondeMotivo
    })
  }, [
    devolucoes,
    buscaCentral,
    filtroCidadeCentral,
    filtroMotivoCentral,
    nomesEntregadores,
    nomesCidades,
  ])

  const dadosPorCidade = useMemo(() => {
    const contagem = {}

    cidades.forEach((cidade) => {
      contagem[cidade.id] = {
        id: cidade.id,
        nome: cidade.nome,
        total: 0,
        recebidas: 0,
        pendentes: 0,
        percentual: 0,
      }
    })

    devolucoes.forEach((item) => {
      const id = item.cidade_id

      if (!contagem[id]) {
        contagem[id] = {
          id: id || 'nao-identificada',
          nome: 'Não identificada',
          total: 0,
          recebidas: 0,
          pendentes: 0,
          percentual: 0,
        }
      }

      contagem[id].total += 1

      if (item.status === 'recebido') {
        contagem[id].recebidas += 1
      } else {
        contagem[id].pendentes += 1
      }
    })

    return Object.values(contagem)
      .map((item) => ({
        ...item,
        percentual:
          item.total > 0
            ? Math.round((item.recebidas / item.total) * 100)
            : 0,
      }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
  }, [devolucoes, cidades])

  const dadosPorMotivo = useMemo(() => {
    const contagem = {}

    devolucoes.forEach((item) => {
      const motivoItem = item.motivo || 'Não informado'
      contagem[motivoItem] = (contagem[motivoItem] || 0) + 1
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
            <img className="brand-logo" src="/logo-pmello.png" alt="P. MELLO Transportes" />
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
            <img className="brand-logo" src="/logo-pmello.png" alt="P. MELLO Transportes" />
            <div>
              <h1>P. MELLO</h1>
              <span>TRANSPORTES</span>
            </div>
          </div>
          <button className="logout" onClick={sair}>Sair</button>
        </header>

        <section className="welcome">
          <span className="eyebrow">CONTROLE DE ACESSO</span>
          <h2>{contaSuspensa ? 'Acesso suspenso.' : 'Aguardando aprovação.'}</h2>
          <p>
            {contaSuspensa
              ? 'Sua conta está temporariamente sem acesso à operação. Entre em contato com o administrador da P. MELLO Transportes.'
              : 'Sua conta ainda não tem acesso à operação. Aguarde a liberação da equipe responsável.'}
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
        ? [{ id: 'registrar', titulo: 'Criar tarefa de devolução', icone: '+' }]
        : []),
      ...(podeConferir
        ? [
            { id: 'central', titulo: 'Central de devoluções', icone: '▤' },
            { id: 'usuarios', titulo: 'Gestão de usuários', icone: '♙' },
          ]
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

    const listaHistorico = devolucoesFiltradas
    const listaCentral = devolucoesCentralFiltradas

    const listaExibida =
      paginaAtual === 'central' ? listaCentral : listaHistorico

    const cidadeDoEntregador = cidades.find(
      (cidade) => String(cidade.id) === String(perfil.cidade_id)
    )

    return (
      <main className="dashboard">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img className="brand-logo" src="/logo-pmello.png" alt="P. MELLO Transportes" />
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
                      {ehAdmin
                        ? 'PAINEL DE GESTÃO'
                        : podeConferir
                          ? 'PAINEL DA BASE'
                          : 'PAINEL DO ENTREGADOR'}
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
                        <p>Volume, recebimentos e pendências de cada cidade.</p>
                      </div>
                    </div>
                    <DistribuicaoCidades dados={dadosPorCidade} />
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
                          {item.tarefa_id && (
                            <small>
                              Tarefa: {String(item.tarefa_id).slice(0, 8).toUpperCase()}
                            </small>
                          )}
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
                    <h3>Criar tarefa de devolução</h3>
                    <p>
                      Adicione todos os pacotes que serão entregues à base em uma única tarefa.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: '#202020',
                    border: '1px solid #383838',
                    borderRadius: '12px',
                    padding: '15px',
                    marginBottom: '20px',
                  }}
                >
                  <small style={{ color: '#aaa' }}>Cidade vinculada ao seu cadastro</small>
                  <strong style={{ display: 'block', color: '#ffd400', marginTop: '5px' }}>
                    {cidadeDoEntregador?.nome || 'Cidade não vinculada'}
                  </strong>
                  {!perfil.cidade_id && (
                    <p className="error-message">
                      Seu cadastro ainda não possui cidade vinculada. Peça ao administrador para configurar seu perfil.
                    </p>
                  )}
                </div>

                <form onSubmit={registrarDevolucao}>
                  <label htmlFor="codigo">Código de rastreio</label>
                  <input
                    id="codigo"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Digite ou escaneie o código"
                    autoComplete="off"
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

                  <label htmlFor="motivo">Motivo da devolução</label>
                  <select
                    id="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
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
                      />
                    </>
                  )}

                  <button
                    type="button"
                    className="refresh-button"
                    onClick={adicionarPacoteTarefa}
                    disabled={enviando}
                    style={{ width: '100%', marginTop: '12px' }}
                  >
                    + Adicionar pacote à tarefa
                  </button>

                  <section
                    style={{
                      marginTop: '25px',
                      padding: '16px',
                      border: '1px solid #383838',
                      borderRadius: '12px',
                      background: '#171717',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        marginBottom: '15px',
                      }}
                    >
                      <strong>Pacotes adicionados</strong>
                      <span className="count-pill">
                        {pacotesTarefa.length} pacote(s)
                      </span>
                    </div>

                    {pacotesTarefa.length === 0 ? (
                      <p className="notice">
                        Nenhum pacote adicionado. Informe o código e o motivo acima.
                      </p>
                    ) : (
                      pacotesTarefa.map((item, index) => (
                        <article
                          key={`${item.codigo_rastreio}-${index}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            marginBottom: '10px',
                            background: '#252525',
                            borderRadius: '9px',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>
                              {item.codigo_rastreio}
                            </strong>
                            <small style={{ color: '#aaa' }}>{item.motivo}</small>
                            {item.detalhes_motivo && (
                              <small style={{ display: 'block', color: '#aaa' }}>
                                {item.detalhes_motivo}
                              </small>
                            )}
                          </div>
                          <button
                            type="button"
                            className="logout"
                            onClick={() => removerPacoteTarefa(index)}
                            disabled={enviando}
                            style={{
                              color: '#ff7777',
                              borderColor: '#dc5555',
                              flexShrink: 0,
                            }}
                          >
                            Remover
                          </button>
                        </article>
                      ))
                    )}
                  </section>

                  <button
                    className="login-button"
                    type="submit"
                    disabled={enviando || !perfil.cidade_id || pacotesTarefa.length === 0 && !codigo.trim()}
                    style={{ marginTop: '18px' }}
                  >
                    {enviando
                      ? 'Criando tarefa...'
                      : `Criar tarefa (${pacotesTarefa.length + (codigo.trim() ? 1 : 0)} pacote(s))`}
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
                    <p>{listaExibida.length} registro(s) encontrado(s).</p>
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
                    placeholder="Pesquisar código, tarefa, entregador, cidade ou motivo..."
                    value={paginaAtual === 'central' ? buscaCentral : busca}
                    onChange={(e) =>
                      paginaAtual === 'central'
                        ? setBuscaCentral(e.target.value)
                        : setBusca(e.target.value)
                    }
                  />

                  {paginaAtual === 'historico' && (
                    <select
                      value={filtroStatus}
                      onChange={(e) => setFiltroStatus(e.target.value)}
                    >
                      <option value="todos">Todos os status</option>
                      <option value="pendente">Aguardando recebimento</option>
                      <option value="recebido">Recebidos</option>
                    </select>
                  )}

                  <select
                    value={
                      paginaAtual === 'central'
                        ? filtroCidadeCentral
                        : filtroCidade
                    }
                    onChange={(e) =>
                      paginaAtual === 'central'
                        ? setFiltroCidadeCentral(e.target.value)
                        : setFiltroCidade(e.target.value)
                    }
                  >
                    <option value="todas">Todas as cidades</option>
                    {cidades.map((cidade) => (
                      <option key={cidade.id} value={cidade.id}>
                        {cidade.nome}
                      </option>
                    ))}
                  </select>

                  <select
                    value={
                      paginaAtual === 'central'
                        ? filtroMotivoCentral
                        : filtroMotivo
                    }
                    onChange={(e) =>
                      paginaAtual === 'central'
                        ? setFiltroMotivoCentral(e.target.value)
                        : setFiltroMotivo(e.target.value)
                    }
                  >
                    <option value="todos">Todos os motivos</option>
                    {motivos.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                {listaExibida.length === 0 ? (
                  <p className="notice">
                    Nenhuma devolução encontrada com os filtros selecionados.
                  </p>
                ) : (
                  listaExibida.map((item) => (
                    <article className="return-detail-card" key={item.id}>
                      <div className="return-detail-heading">
                        <strong>{item.codigo_rastreio}</strong>
                        <span className={`return-status ${item.status === 'recebido' ? 'received' : 'pending'}`}>
                          {item.status === 'recebido'
                            ? 'Recebido pela base'
                            : 'Aguardando recebimento'}
                        </span>
                      </div>

                      {item.tarefa_id && (
                        <div
                          style={{
                            background: '#292929',
                            borderRadius: '8px',
                            padding: '9px 12px',
                            marginBottom: '12px',
                          }}
                        >
                          <small style={{ color: '#aaa' }}>Tarefa vinculada</small>
                          <strong
                            style={{
                              display: 'block',
                              color: '#ffd400',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {String(item.tarefa_id).slice(0, 8).toUpperCase()}
                          </strong>
                        </div>
                      )}

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
                          {recebendoId === item.id
                            ? 'Confirmando...'
                            : 'Confirmar recebimento físico'}
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
                      <p>Comparativo de recebimentos e pendências por localidade.</p>
                    </div>
                  </div>
                  <DistribuicaoCidades dados={dadosPorCidade} />
                </section>

                <section className="content-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Devoluções por motivo</h3>
                      <p>Distribuição dos principais motivos registrados pela equipe.</p>
                    </div>
                  </div>
                  <DistribuicaoMotivos dados={dadosPorMotivo} />
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

            {paginaAtual === 'usuarios' && podeConferir && (() => {
              const idsPendentes = new Set(pendentes.map((item) => item.id))
              const ativos = usuarios.filter((item) => item.ativo && !idsPendentes.has(item.id)).length
              const suspensos = usuarios.filter((item) => !item.ativo && !idsPendentes.has(item.id)).length

              const normalizarUsuario = (valor) =>
                String(valor ?? '')
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
                  .toLowerCase()

              const usuariosFiltrados = usuarios.filter((item) => {
                const termo = normalizarUsuario(buscaUsuario)

                const correspondeBusca =
                  !termo ||
                  normalizarUsuario(item.nome).includes(termo) ||
                  normalizarUsuario(item.id).includes(termo)

                const correspondePerfil =
                  filtroPerfilUsuario === 'todos' ||
                  item.perfil === filtroPerfilUsuario

                const situacao = idsPendentes.has(item.id)
                  ? 'pendente'
                  : item.ativo
                    ? 'ativo'
                    : 'suspenso'

                const correspondeSituacao =
                  filtroSituacaoUsuario === 'todos' ||
                  situacao === filtroSituacaoUsuario

                return correspondeBusca && correspondePerfil && correspondeSituacao
              })

              return (
                <>
                  <section className="dashboard-heading">
                    <div>
                      <span className="eyebrow">CONTROLE DE ACESSOS</span>
                      <h3>Gestão de usuários</h3>
                      <p>Consulte solicitações, perfis e situação das contas da operação.</p>
                    </div>
                    <button
                      className="refresh-button"
                      type="button"
                      disabled={atualizando}
                      onClick={async () => {
                        setAtualizando(true)
                        await carregarPendentes()
                        await carregarUsuarios()
                        setAtualizando(false)
                      }}
                    >
                      {atualizando ? 'Atualizando...' : '↻ Atualizar'}
                    </button>
                  </section>

                  <section className="dashboard-cards">
                    <article className="metric-card success">
                      <span className="metric-label">Usuários ativos</span>
                      <strong>{ativos}</strong>
                      <small>Contas liberadas para acessar</small>
                    </article>
                    <article className="metric-card warning">
                      <span className="metric-label">Cadastros pendentes</span>
                      <strong>{pendentes.length}</strong>
                      <small>Aguardando análise da equipe</small>
                    </article>
                    <article className="metric-card">
                      <span className="metric-label">Usuários suspensos</span>
                      <strong>{suspensos}</strong>
                      <small>Contas sem acesso ativo</small>
                    </article>
                  </section>

                  <section className="content-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Solicitações de acesso</h3>
                        <p>A base e o administrador podem aprovar ou rejeitar novos cadastros.</p>
                      </div>
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
                            <label htmlFor={`perfil-usuario-${item.id}`}>Perfil para liberar</label>
                            <select
                              id={`perfil-usuario-${item.id}`}
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

                  <section className="content-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Usuários cadastrados</h3>
                        <p>Lista de contas e respectivos níveis de acesso.</p>
                      </div>
                      <span className="notice">{usuariosFiltrados.length} registro(s)</span>
                    </div>

                    <div className="filters">
                      <input
                        aria-label="Buscar usuário"
                        placeholder="Buscar por nome ou ID"
                        value={buscaUsuario}
                        onChange={(e) => setBuscaUsuario(e.target.value)}
                      />

                      <select
                        aria-label="Filtrar por perfil"
                        value={filtroPerfilUsuario}
                        onChange={(e) => setFiltroPerfilUsuario(e.target.value)}
                      >
                        <option value="todos">Todos os perfis</option>
                        <option value="admin">Administrador</option>
                        <option value="base">Equipe da base</option>
                        <option value="entregador">Entregador</option>
                      </select>

                      <select
                        aria-label="Filtrar por situação"
                        value={filtroSituacaoUsuario}
                        onChange={(e) => setFiltroSituacaoUsuario(e.target.value)}
                      >
                        <option value="todos">Todas as situações</option>
                        <option value="ativo">Ativos</option>
                        <option value="pendente">Pendentes</option>
                        <option value="suspenso">Suspensos</option>
                      </select>
                    </div>

                    {usuariosFiltrados.length === 0 ? (
                      <p className="notice">
                        Nenhum usuário encontrado com esses filtros. Se houver erro de permissão, confira as políticas de leitura da tabela profiles no Supabase.
                      </p>
                    ) : (
                      usuariosFiltrados.map((item) => {
                        const pendente = idsPendentes.has(item.id)
                        const situacao = pendente
                          ? 'Pendente'
                          : item.ativo
                            ? 'Ativo'
                            : 'Suspenso'

                        const perfilTexto =
                          item.perfil === 'admin'
                            ? 'Administrador'
                            : item.perfil === 'base'
                              ? 'Equipe da base'
                              : 'Entregador'

                        return (
                          <article className="action-card" key={item.id}>
                            <span className="action-icon">
                              {item.ativo ? '✓' : pendente ? '!' : '⏸'}
                            </span>

                            <span className="action-text">
                              <strong>{item.nome || 'Usuário sem nome'}</strong>
                              <small>Perfil: {perfilTexto}</small>
                              <small>Situação: {situacao}</small>
                              <small>Cadastrado em: {formatarData(item.criado_em)}</small>

                              {ehAdmin && item.id !== usuario.id && !pendente && (
                                <button
                                  type="button"
                                  className={item.ativo ? 'logout' : 'login-button'}
                                  title={item.ativo ? 'Suspender conta' : 'Reativar conta'}
                                  aria-label={item.ativo ? 'Suspender conta' : 'Reativar conta'}
                                  disabled={alterandoStatusId !== null}
                                  onClick={() => alterarStatusUsuario(item)}
                                  style={{
                                    width: 'auto',
                                    minWidth: '150px',
                                    marginTop: '12px',
                                    borderColor: item.ativo ? '#dc5555' : '#ffd400',
                                    color: item.ativo ? '#ff7777' : '#111',
                                  }}
                                >
                                  {alterandoStatusId === item.id
                                    ? 'Processando...'
                                    : item.ativo
                                      ? '⏸ Suspender conta'
                                      : '▶ Ativar conta'}
                                </button>
                              )}
                            </span>
                          </article>
                        )
                      })
                    )}
                  </section>
                </>
              )
            })()}

            {paginaAtual === 'configuracoes' && ehAdmin && (
              <section className="content-panel">
                <h3>Configurações da conta</h3>
                <div className="settings-row">
                  <span><small>Nome</small>{perfil.nome}</span>
                  <span><small>E-mail</small>{usuario.email}</span>
                  <span><small>Perfil de acesso</small>{nomePerfil}</span>
                </div>
              </section>
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
          <img className="brand-logo" src="/logo-pmello.png" alt="P. MELLO Transportes" />
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
        <p>Entre com seu e-mail e senha para acessar o sistema de devoluções.</p>
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '-10px',
                  marginBottom: '18px',
                }}
              >
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
              Preencha seus dados. O acesso à operação depende da aprovação da equipe responsável.
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

              <label htmlFor="cidadeCadastro">Cidade onde mora/presta serviço</label>
              <select
                id="cidadeCadastro"
                name="cidadeCadastro"
                value={cidadeCadastro}
                onChange={(e) => setCidadeCadastro(e.target.value)}
                required
                disabled={carregandoCidades || cidades.length === 0 || enviando}
                style={{
                  display: 'block',
                  width: '100%',
                  minHeight: '48px',
                  marginBottom: '18px',
                  padding: '12px 14px',
                  color: '#f5f5f5',
                  backgroundColor: '#11151a',
                  border: '1px solid #3a424d',
                  borderRadius: '11px',
                  fontSize: '14px',
                  fontWeight: 500,
                  colorScheme: 'dark',
                  cursor: carregandoCidades || cidades.length === 0 ? 'wait' : 'pointer',
                }}
              >
                <option value="">
                  {carregandoCidades ? 'Carregando cidades...' : 'Selecione sua cidade'}
                </option>
                {cidades.map((cidade) => (
                  <option key={cidade.id} value={String(cidade.id)}>
                    {cidade.nome}
                  </option>
                ))}
              </select>
              {erroCidades && <p className="error-message">{erroCidades}</p>}
              {!carregandoCidades && !erroCidades && cidades.length === 0 && (
                <p className="error-message">Nenhuma cidade ativa disponível para cadastro.</p>
              )}

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

              <button className="login-button" type="submit" disabled={enviando || carregandoCidades || cidades.length === 0}>
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
              Informe seu e-mail cadastrado. Se a conta existir, enviaremos um link de redefinição.
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