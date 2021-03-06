import SubjectService from './subject.service.vue';
import VueJsonPretty from 'vue-json-pretty'
import Chess from 'chess.js'
import ChessGame from '../../components/chessgame/ChessGame.vue'
import 'vue-chessboard/dist/vue-chessboard.css'
import axios from 'axios'

const SubjectDetails = {
    mixins: [SubjectService],
    components: {
        chessgame: ChessGame,
        VueJsonPretty
    },
    data() {
        return {
            subjectId: null,
            versions: [],
            currentFen: '',
            currentLastMove: '',
            currentOrientation: 'white'
        };
    },
    beforeRouteEnter(to, from, next) {
        next(vm => {
            if (to.params.subjectId) {
                vm.retrieveSubject(to.params.subjectId);
            }
        });
    },
    methods: {
        submitMove(data) {
            this.positionInfo = data;
            axios.post(`subjects/${this.subjectId}/versions`, {schemaType: "CHESS", schema: data.history[data.history.length-1]})
                .then(response => {
                    var id = response.data.id;
                    axios.get(`subjects/${this.subjectId}/versions/latest`)
                        .then(response => {
                            var pgn = response.data.schema;
                            var chess = new Chess();
                            chess.load_pgn(pgn);
                            var history = chess.history();
                            this.currentLastMove = history[history.length-1];
                            this.versions.push(response.data);
                        })
                })
                .catch(error => {
                    // See https://github.com/axios/axios/issues/960
                    let errorObject = JSON.parse(JSON.stringify(error));
                    this.error = errorObject.response.data.message;
                });

        },
        loadFen(fen) {
            this.currentFen = fen
        },
        loadLastMove(lastMove) {
            this.currentLastMove = lastMove
        },
        flip() {
            this.currentOrientation = this.currentOrientation === 'white' ? 'black' : 'white';
        },
        promote() {
            if (confirm("Want to promote to rook? Queen by default") ) {
                return 'r'
            } else {
                return 'q'
            }
        },
        retrieveSubject(subjectId) {
            this.subjectId = subjectId;
            var service = this;
            var newVersions = []
            this.findSubject(subjectId).then(response => {
                var promises = response.data.map(function (element) {
                    return service.findVersion(subjectId, element).then(response => {
                        newVersions.push(response.data);
                    })
                });

                Promise.all(promises).then(versions => {
                    this.versions = newVersions
                    if (newVersions.length > 0) {
                        newVersions.sort((a, b) => (a.version > b.version) ? 1 : ((b.version > a.version) ? -1 : 0));
                        var lastVersion = newVersions[newVersions.length-1];
                        var pgn = lastVersion.schema;
                        var chess = new Chess();
                        chess.load_pgn(pgn);
                        this.currentOrientation = chess.turn() === 'w' ? 'white' : 'black';
                        this.loadFen(chess.fen());
                    }
                    this.versions = newVersions
                });
            })
                .catch(() => {
                    this.previousState();
                })
        },
        prepareRemove(instance) {
            this.removeId = instance.version;
            this.$refs.removeEntity.show();
        },
        removeVersion() {
            this.deleteVersion(this.subjectId, this.removeId).then(() => {
                this.removeId = null;
                this.retrieveSubject(this.subjectId);
                this.closeDialog();
            })
        },
        previousState() {
            this.$router.go(-1);
        },
        closeDialog() {
            this.$refs.removeEntity.hide();
        }
    },
    computed: {
        gameResult: function () {
            if (this.versions.length == 0) {
                return '';
            }
            var lastVersion = this.versions[this.versions.length-1].schema;
            var lastMove = lastVersion.substring(lastVersion.lastIndexOf(" ") + 1);
            if (lastMove === '1-0') {
                return 'White won!';
            } else if (lastMove === '0-1') {
                return 'Black won!';
            } else {
                return '';
            }
        },
        sortedVersions: function () {
            return this.versions.sort((a, b) => (a.version > b.version) ? 1 : ((b.version > a.version) ? -1 : 0));
        }
    }
};

export default SubjectDetails;
