# Kimeru

Kimeru is a self-hosted playground for testing decision AI models through user-configured providers. It serves individuals and organizations.

## Language

**Provider connection**:
A saved configuration identifying a decision AI service, its base URL, and the credentials needed to access it.
_Avoid_: Chat provider

**Personal connection**:
A provider connection owned by one user and available only to that user.
_Avoid_: Private model

**Shared connection**:
A provider connection managed by an administrator and made available to users without revealing its credentials.
_Avoid_: Shared API key

**Administrator**:
A user who manages accounts and shared provider connections. This role does not automatically grant access to other users' saved work.
_Avoid_: Workspace owner

**Playground**:
A user's saved working configuration of state, questions, and model selection for testing decisions.
_Avoid_: Chat, conversation

**State**:
The input context supplied to a model for answering decision questions.
_Avoid_: Chat message

**Question**:
A named decision request with a result type and the instructions or criteria applicable to that type.
_Avoid_: Chat prompt

**Run**:
One execution of a set of questions against a supplied state using a selected provider connection and model. Its saved record belongs to the user who ran it.
_Avoid_: Conversation, chat turn

**Result**:
The typed answers returned by a model for a run. Results may include probabilities, scores, or image regions depending on the question type.
_Avoid_: Chat response

**Box**:
A question type that locates a region in an image. Its result is displayed as a bounding rectangle over the corresponding image.
_Avoid_: Square
