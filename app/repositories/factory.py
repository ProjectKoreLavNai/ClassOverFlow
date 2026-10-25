from app.config import settings


class RepositoryFactory:
    @staticmethod
    def get_user_repository():
        if settings.storage_backend == "database":
            from app.repositories.user_repository import UserRepository
            return UserRepository
        from app.repositories.in_memory_store import InMemoryStore
        return InMemoryStore

    @staticmethod
    def get_course_repository():
        if settings.storage_backend == "database":
            from app.repositories.course_repository import CourseRepository
            return CourseRepository
        from app.repositories.in_memory_store import InMemoryStore
        return InMemoryStore

    @staticmethod
    def get_announcement_repository():
        if settings.storage_backend == "database":
            from app.repositories.announcement_repository import AnnouncementRepository
            return AnnouncementRepository
        from app.repositories.in_memory_store import InMemoryStore
        return InMemoryStore
