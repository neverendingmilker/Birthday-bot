module.exports = {
  name: 'messageCreate',
  once: false,
  async execute(message) {
    // Only the quiz feature currently needs to listen to plain chat messages
    // (open_answer mode: guessing the title/artist by typing them).
    try {
      const quizManager = require('../features/quiz/quizManager');
      await quizManager.handleChatAnswer(message);
    } catch (err) {
      console.error('Error handling a quiz chat answer:', err);
    }
  },
};
