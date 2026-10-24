import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuizEditor from './QuizEditor';

function setup(props: Partial<Parameters<typeof QuizEditor>[0]> = {}) {
  const onSubmit = vi.fn();
  render(<QuizEditor onSubmit={onSubmit} onCancel={vi.fn()} {...props} />);
  return { onSubmit, user: userEvent.setup() };
}

describe('QuizEditor', () => {
  it('builds a quiz with multiple questions and marks the correct answers', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText('Quiz title'), 'Week 1 check');
    await user.type(screen.getByLabelText('Question 1 prompt'), 'Capital of NZ?');
    await user.type(screen.getByLabelText('Question 1 option 1'), 'Auckland');
    await user.type(screen.getByLabelText('Question 1 option 2'), 'Wellington');
    await user.click(screen.getByLabelText('Mark option 2 of question 1 as correct'));

    await user.click(screen.getByRole('button', { name: '+ Add question' }));
    await user.type(screen.getByLabelText('Question 2 prompt'), 'Largest AU state?');
    await user.click(screen.getAllByRole('button', { name: '+ Add option' })[1]);
    await user.type(screen.getByLabelText('Question 2 option 1'), 'NSW');
    await user.type(screen.getByLabelText('Question 2 option 2'), 'QLD');
    await user.type(screen.getByLabelText('Question 2 option 3'), 'WA');
    await user.click(screen.getByLabelText('Mark option 3 of question 2 as correct'));

    await user.click(screen.getByRole('button', { name: 'Save quiz' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Week 1 check',
      passMark: 70,
      maxAttempts: 3,
      questions: [
        { prompt: 'Capital of NZ?', options: ['Auckland', 'Wellington'], correctIndex: 1 },
        { prompt: 'Largest AU state?', options: ['NSW', 'QLD', 'WA'], correctIndex: 2 },
      ],
    });
  });

  it('blocks saving with empty options', async () => {
    const { onSubmit, user } = setup();
    await user.type(screen.getByLabelText('Quiz title'), 'Draft');
    await user.type(screen.getByLabelText('Question 1 prompt'), 'Q?');
    await user.type(screen.getByLabelText('Question 1 option 1'), 'Yes');
    await user.click(screen.getByRole('button', { name: 'Save quiz' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Fill in every option for question 1');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the correct answer on the same option when an earlier option is removed', async () => {
    const { onSubmit, user } = setup({
      initial: { title: 'Quiz', passMark: 50, maxAttempts: 1, questions: [{ prompt: 'Pick C', options: ['A', 'B', 'C'], correctIndex: 2 }] },
    });
    await user.click(screen.getByLabelText('Remove option 1'));
    await user.click(screen.getByRole('button', { name: 'Save quiz' }));
    expect(onSubmit.mock.calls[0][0].questions[0]).toEqual({ prompt: 'Pick C', options: ['B', 'C'], correctIndex: 1 });
  });

  it('locks questions once students have attempted the quiz', () => {
    setup({ locked: true, initial: { title: 'Q', passMark: 50, maxAttempts: 1, questions: [{ prompt: 'P', options: ['A', 'B'], correctIndex: 0 }] } });
    expect(screen.getByLabelText('Question 1 prompt')).toBeDisabled();
    expect(screen.getByLabelText('Quiz title')).toBeEnabled();
  });
});
