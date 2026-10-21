
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking
} from 'react-native';

// CONFIGURACOES DO FIREBASE
const API_KEY = 'AIzaSyA23vbAnUZYOl37BjQD4obnESLKxaGQL-g';
const DATABASE_URL = 'https://samuel-9b151-default-rtdb.firebaseio.com';
const PERSONAL_EMAIL = 'samuelroqueee.25@gmail.com';

export default function App() {
  const [screen, setScreen] = useState('inicio');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const [alunos, setAlunos] = useState([]);
  const [treinos, setTreinos] = useState([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);

  const [tituloTreino, setTituloTreino] = useState('');
  const [exercicios, setExercicios] = useState('');

  const verde = '#39FF14';

  async function requisicaoBanco(
    caminho,
    metodo = 'GET',
    dados = null,
    conta = usuario
  ) {
    if (!conta?.token) {
      throw new Error('Faça login novamente.');
    }

    const url =
      `${DATABASE_URL}/${caminho}.json?auth=${conta.token}`;

    const resposta = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      ...(dados !== null
        ? { body: JSON.stringify(dados) }
        : {})
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        typeof resultado?.error === 'string'
          ? resultado.error
          : 'Erro ao acessar o banco de dados.'
      );
    }

    return resultado;
  }

  async function autenticar(cadastrar) {
    setErro('');

    if (!email.trim() || !senha) {
      setErro('Digite seu e-mail e sua senha.');
      return;
    }

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (cadastrar && !nome.trim()) {
      setErro('Digite seu nome.');
      return;
    }

    setCarregando(true);

    try {
      const acao = cadastrar
        ? 'signUp'
        : 'signInWithPassword';

      const resposta = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:${acao}?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            password: senha,
            returnSecureToken: true
          })
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        const codigo = dados.error?.message || '';

        const mensagens = {
          EMAIL_EXISTS: 'Este e-mail já está cadastrado.',
          INVALID_LOGIN_CREDENTIALS: 'E-mail ou senha incorretos.',
          EMAIL_NOT_FOUND: 'Este e-mail não está cadastrado.',
          INVALID_PASSWORD: 'E-mail ou senha incorretos.',
          INVALID_EMAIL: 'O e-mail informado é inválido.',
          WEAK_PASSWORD: 'Escolha uma senha com pelo menos 6 caracteres.',
          TOO_MANY_ATTEMPTS_TRY_LATER: 'Muitas tentativas. Tente mais tarde.',
          OPERATION_NOT_ALLOWED: 'Ative o login por e-mail e senha no Firebase Authentication.',
          API_KEY_INVALID: 'A API Key do Firebase é inválida.'
        };

        throw new Error(
          mensagens[codigo] ||
          `Erro do Firebase: ${codigo || 'verifique a configuração'}`
        );
      }

      const conta = {
        uid: dados.localId,
        email: dados.email,
        token: dados.idToken
      };

      setUsuario(conta);

      const administrador =
        dados.email.toLowerCase() ===
        PERSONAL_EMAIL.toLowerCase();

      if (cadastrar && !administrador) {
        const perfil = {
          uid: conta.uid,
          nome: nome.trim(),
          email: conta.email,
          criadoEm: new Date().toISOString()
        };

        const url =
          `${DATABASE_URL}/usuarios/${conta.uid}.json?auth=${conta.token}`;

        const salvar = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(perfil)
        });

        if (!salvar.ok) {
          const resultado = await salvar.json();

          throw new Error(
            `Conta criada, mas o perfil não foi salvo: ${resultado.error || 'verifique as regras do banco'}. Tente entrar novamente.`
          );
        }
      }

      setEmail('');
      setSenha('');
      setNome('');
      setErro('');

      if (administrador) {
        setScreen('personal');
        await carregarAlunos(conta);
      } else {
        setScreen('aluno');
        await carregarTreinos(conta);
      }
    } catch (e) {
      setErro(e.message || 'Erro de conexão com o Firebase.');
    } finally {
      setCarregando(false);
    }
  }

  async function carregarAlunos(conta = usuario) {
    try {
      const url =
        `${DATABASE_URL}/usuarios.json?auth=${conta.token}`;

      const resposta = await fetch(url);
      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof dados?.error === 'string'
            ? dados.error
            : 'Não foi possível carregar os alunos.'
        );
      }

      const lista = Object.values(dados || {})
        .filter(a => a && a.uid && a.email)
        .filter(
          a =>
            a.email.toLowerCase() !==
            PERSONAL_EMAIL.toLowerCase()
        );

      setAlunos(lista);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar alunos.');
    }
  }

  async function carregarTreinos(conta = usuario) {
    try {
      const dados = await requisicaoBanco(
        `treinos/${conta.uid}`,
        'GET',
        null,
        conta
      );

      const lista = dados
        ? Object.entries(dados).map(([id, treino]) => ({
            id,
            ...treino
          }))
        : [];

      setTreinos(lista.reverse());
    } catch (e) {
      setErro(e.message || 'Erro ao carregar treinos.');
    }
  }

  async function publicarTreino() {
    setErro('');

    if (!alunoSelecionado) {
      setErro('Selecione um aluno.');
      return;
    }

    if (!tituloTreino.trim() || !exercicios.trim()) {
      setErro('Preencha o título e os exercícios.');
      return;
    }

    const listaExercicios = exercicios
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const separador = item.indexOf('|');

        const nomeExercicio =
          separador === -1
            ? item.trim()
            : item.slice(0, separador).trim();

        const youtubeUrl =
          separador === -1
            ? ''
            : item.slice(separador + 1).trim();

        return {
          nome: nomeExercicio,
          youtubeUrl
        };
      });

    if (listaExercicios.some(item => !item.nome)) {
      setErro('Confira o nome de cada exercício.');
      return;
    }

    const linkInvalido = listaExercicios.some(item => {
      if (!item.youtubeUrl) return false;

      if (!/^https?:\/\//i.test(item.youtubeUrl)) {
        return true;
      }

      return !(
        /youtube\.com/i.test(item.youtubeUrl) ||
        /youtu\.be/i.test(item.youtubeUrl)
      );
    });

    if (linkInvalido) {
      setErro(
        'Confira os links: use endereços do YouTube começando com https://'
      );
      return;
    }

    setCarregando(true);

    try {
      await requisicaoBanco(
        `treinos/${alunoSelecionado.uid}`,
        'POST',
        {
          titulo: tituloTreino.trim(),
          exercicios: listaExercicios,
          alunoUid: alunoSelecionado.uid,
          publicadoPor: usuario.email,
          criadoEm: new Date().toISOString()
        }
      );

      setTituloTreino('');
      setExercicios('');
      setErro('Treino publicado com sucesso!');
    } catch (e) {
      setErro(e.message || 'Não foi possível publicar o treino.');
    } finally {
      setCarregando(false);
    }
  }

  async function abrirVideo(url) {
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch (e) {
      setErro('Não foi possível abrir o vídeo. Confira o link.');
    }
  }

  function sair() {
    setUsuario(null);
    setEmail('');
    setSenha('');
    setNome('');
    setErro('');
    setAlunos([]);
    setTreinos([]);
    setAlunoSelecionado(null);
    setScreen('inicio');
  }

  function Botao({ titulo, acao }) {
    return (
      <TouchableOpacity
        style={styles.botao}
        onPress={acao}
        activeOpacity={0.8}
      >
        <Text style={styles.textoBotao}>{titulo}</Text>
      </TouchableOpacity>
    );
  }

  function Campo({
    label,
    value,
    onChangeText,
    placeholder,
    senhaCampo
  }) {
    return (
      <>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={senhaCampo}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </>
    );
  }

  function ItemExercicio({ item, index }) {
    // Aceita os treinos antigos, que guardavam apenas textos.
    const nomeExercicio =
      typeof item === 'string'
        ? item
        : item?.nome || 'Exercício';

    const youtubeUrl =
      typeof item === 'object' && item
        ? item.youtubeUrl
        : '';

    return (
      <View style={styles.exercicio}>
        <Text style={styles.cardTextoExercicio}>
          {index + 1}. {nomeExercicio}
        </Text>

        {!!youtubeUrl && (
          <TouchableOpacity
            style={styles.botaoVideo}
            onPress={() => abrirVideo(youtubeUrl)}
            activeOpacity={0.8}
          >
            <Text style={styles.textoBotaoVideo}>
              ▶ ASSISTIR NO YOUTUBE
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#080808"
      />

      <ScrollView contentContainerStyle={styles.conteudo}>
        <Text style={styles.logo}>SAMUEL</Text>
        <Text style={styles.subLogo}>FITNESS</Text>

        {screen === 'inicio' && (
          <>
            <Text style={styles.titulo}>
              SUA EVOLUÇÃO COMEÇA AQUI
            </Text>

            <Text style={styles.descricao}>
              Treine com foco. Evolua todos os dias.
            </Text>

            <Botao
              titulo="ENTRAR"
              acao={() => setScreen('login')}
            />

            <Botao
              titulo="CRIAR CONTA DE ALUNO"
              acao={() => setScreen('cadastro')}
            />
          </>
        )}

        {(screen === 'login' || screen === 'cadastro') && (
          <>
            <Text style={styles.titulo}>
              {screen === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}
            </Text>

            {screen === 'cadastro' && (
              <Campo
                label="Nome"
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome"
              />
            )}

            <Campo
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
            />

            <Campo
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              placeholder="Mínimo de 6 caracteres"
              senhaCampo
            />

            {!!erro && (
              <Text style={styles.erro}>{erro}</Text>
            )}

            {carregando ? (
              <ActivityIndicator color={verde} size="large" />
            ) : (
              <Botao
                titulo={screen === 'login' ? 'ENTRAR' : 'CADASTRAR'}
                acao={() => autenticar(screen === 'cadastro')}
              />
            )}

            <Botao
              titulo="VOLTAR"
              acao={() => {
                setErro('');
                setScreen('inicio');
              }}
            />
          </>
        )}

        {screen === 'aluno' && (
          <>
            <Text style={styles.titulo}>ÁREA DO ALUNO</Text>

            <Text style={styles.descricao}>
              {usuario?.email}
            </Text>

            {!!erro && (
              <Text style={styles.erro}>{erro}</Text>
            )}

            {treinos.length === 0 ? (
              <Text style={styles.cardTexto}>
                Seus treinos aparecerão aqui assim que o
                personal publicar um treino para sua conta.
              </Text>
            ) : (
              treinos.map(treino => (
                <View style={styles.card} key={treino.id}>
                  <Text style={styles.cardTitulo}>
                    {treino.titulo}
                  </Text>

                  {(treino.exercicios || []).map(
                    (item, index) => (
                      <ItemExercicio
                        key={index}
                        item={item}
                        index={index}
                      />
                    )
                  )}
                </View>
              ))
            )}

            <Botao
              titulo="ATUALIZAR TREINOS"
              acao={() => carregarTreinos()}
            />

            <Botao titulo="SAIR" acao={sair} />
          </>
        )}

        {screen === 'personal' && (
          <>
            <Text style={styles.titulo}>
              PAINEL DO ADMINISTRADOR
            </Text>

            <Text style={styles.descricao}>
              Bem-vindo ao painel do Samuel Fitness.
            </Text>

            {!!erro && (
              <Text style={styles.erro}>{erro}</Text>
            )}

            <Text style={styles.secao}>
              ALUNOS CADASTRADOS
            </Text>

            {alunos.length === 0 && (
              <Text style={styles.cardTexto}>
                Nenhum perfil de aluno encontrado. Os alunos
                precisam criar uma conta no aplicativo para
                aparecer aqui.
              </Text>
            )}

            {alunos.map(aluno => (
              <TouchableOpacity
                key={aluno.uid}
                style={[
                  styles.aluno,
                  alunoSelecionado?.uid === aluno.uid &&
                    styles.alunoAtivo
                ]}
                onPress={() => setAlunoSelecionado(aluno)}
              >
                <Text style={styles.cardTitulo}>
                  {aluno.nome || aluno.email}
                </Text>

                <Text style={styles.descricao}>
                  {aluno.email}
                </Text>

                <Text style={styles.selecionar}>
                  {alunoSelecionado?.uid === aluno.uid
                    ? 'ALUNO SELECIONADO'
                    : 'TOQUE PARA SELECIONAR'}
                </Text>
              </TouchableOpacity>
            ))}

            <Botao
              titulo="ATUALIZAR LISTA DE ALUNOS"
              acao={() => carregarAlunos()}
            />

            <Text style={styles.secao}>PUBLICAR TREINO</Text>

            <Text style={styles.cardTexto}>
              {alunoSelecionado
                ? `Aluno escolhido: ${alunoSelecionado.nome || alunoSelecionado.email}`
                : 'Selecione um aluno na lista acima.'}
            </Text>

            <Campo
              label="Nome do treino"
              value={tituloTreino}
              onChangeText={setTituloTreino}
              placeholder="Ex.: Treino de peito e tríceps"
            />

            <Text style={styles.label}>Exercícios e vídeos</Text>

            <Text style={styles.instrucao}>
              Um exercício por linha. Para adicionar vídeo,
              coloque o símbolo | depois do nome e cole o
              link do YouTube.
            </Text>

            <TextInput
              style={[styles.input, styles.multiline]}
              value={exercicios}
              onChangeText={setExercicios}
              placeholder={
                'Supino reto - 4x10 | https://youtu.be/ID_DO_VIDEO\nCrucifixo - 3x12\nCrossover - 3x12 | https://www.youtube.com/watch?v=ID'
              }
              placeholderTextColor="#888"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            {carregando ? (
              <ActivityIndicator color={verde} size="large" />
            ) : (
              <Botao
                titulo="PUBLICAR TREINO"
                acao={publicarTreino}
              />
            )}

            <Botao titulo="SAIR" acao={sair} />
          </>
        )}

        <Text style={styles.rodape}>
          FOCO • DISCIPLINA • RESULTADO
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808'
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 25
  },
  logo: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 3
  },
  subLogo: {
    color: '#39FF14',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 45
  },
  titulo: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20
  },
  descricao: {
    color: '#BBBBBB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12
  },
  label: {
    color: '#39FF14',
    marginBottom: 8,
    marginTop: 10
  },
  instrucao: {
    color: '#BBBBBB',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8
  },
  input: {
    backgroundColor: '#191919',
    borderColor: '#333333',
    borderWidth: 1,
    borderRadius: 10,
    color: '#FFFFFF',
    padding: 15,
    marginBottom: 10
  },
  multiline: {
    minHeight: 160,
    textAlignVertical: 'top'
  },
  botao: {
    backgroundColor: '#39FF14',
    padding: 16,
    borderRadius: 10,
    marginVertical: 8,
    alignItems: 'center'
  },
  textoBotao: {
    color: '#080808',
    fontWeight: '900',
    fontSize: 15
  },
  erro: {
    color: '#FF7777',
    marginVertical: 12,
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#191919',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12
  },
  cardTexto: {
    color: '#FFFFFF',
    backgroundColor: '#191919',
    padding: 14,
    borderRadius: 10,
    lineHeight: 23,
    marginBottom: 10
  },
  cardTextoExercicio: {
    color: '#FFFFFF',
    lineHeight: 23,
    marginBottom: 8
  },
  exercicio: {
    borderBottomColor: '#333333',
    borderBottomWidth: 1,
    paddingVertical: 10
  },
  botaoVideo: {
    backgroundColor: '#242424',
    borderColor: '#39FF14',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 5
  },
  textoBotaoVideo: {
    color: '#39FF14',
    fontSize: 13,
    fontWeight: '900'
  },
  cardTitulo: {
    color: '#39FF14',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8
  },
  secao: {
    color: '#39FF14',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 25,
    marginBottom: 12
  },
  aluno: {
    backgroundColor: '#191919',
    borderColor: '#333333',
    borderWidth: 1,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10
  },
  alunoAtivo: {
    borderColor: '#39FF14',
    borderWidth: 2
  },
  selecionar: {
    color: '#39FF14',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 8
  },
  rodape: {
    color: '#666666',
    textAlign: 'center',
    fontSize: 10,
    marginTop: 35,
    letterSpacing: 2
  }
});
