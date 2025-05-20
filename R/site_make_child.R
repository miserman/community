#' Make a Copy of a Data Site
#'
#' Copies baseline files from an existing data site. Useful for making different sites
#' based on the same data.
#'
#' @param parent Directory or GitHub repository name of the existing site to be copied.
#' @param dir Directory of the child site to put copies in.
#' @param update Logical; if \code{TRUE}, replaces existing site files if they are older than existing
#' files (from a local directory). Same as \code{overwrite} for remote sites. By default, only the
#' \code{datapackage.json} file is updated.
#' @param overwrite Logical; if \code{TRUE}, overwrites any existing site files. \code{datapackage.json}
#' is always overwritten.
#' @param protect A vector of file paths to prevent from being overwritten, relative to the site directory.
#' @param include A vector of paths to additional files to update from the parent site, relative to the
#' site's base directory.
#' @param quiet Logical; if \code{TRUE}, does not send messages.
#' @examples
#' \dontrun{
#' site_make_child("miserman/community_example", "../community_example")
#' }
#' @return Invisible path to the child directory.
#' @export

site_make_child <- function(
  parent,
  dir,
  update = FALSE,
  overwrite = FALSE,
  protect = "site.R",
  include = NULL,
  quiet = !interactive()
) {
  if (missing(dir))
    cli_abort('{.arg dir} must be speficied (e.g., dir = "child_site")')
  check <- check_template("site", dir = dir)
  if (!quiet && any(file.exists(check$files)) && !overwrite) {
    cli_bullets(c(
      `!` = "site files already exist",
      i = "add {.code overwrite = TRUE} to overwrite them"
    ))
  }
  dir <- normalizePath(paste0(dir, "/", check$spec$dir), "/", FALSE)
  dir.create(dir, FALSE, TRUE)
  dir.create(paste0(dir, "/docs/data"), FALSE, TRUE)
  files <- unique(c(
    unlist(check$spec$files, use.names = FALSE),
    "docs/data/datapackage.json",
    include
  ))
  filled <- copied <- structure(
    !file.exists(paste0(dir, "/", files)),
    names = files
  )
  copied[] <- FALSE
  if (!file.exists(paste0(dir, "/build.R"))) {
    copied["build.R"] <- TRUE
    args <- lapply(match.call()[-1], eval, parent.frame())
    writeLines(
      paste(
        c(
          paste0("# this is a child site spawned from ", parent, ":"),
          paste0(
            "site_make_child(\n  ",
            paste(
              vapply(
                names(args),
                function(a) {
                  if (a %in% c("parent", "dir")) {
                    paste0(a, ' = "', normalizePath(args[[a]], "/", FALSE), '"')
                  } else {
                    paste(a, "=", args[[a]])
                  }
                },
                ""
              ),
              collapse = ",\n  "
            ),
            "\n)"
          ),
          ""
        ),
        collapse = "\n"
      ),
      paste0(dir, "/build.R")
    )
  }
  init_site(dir, with_data = FALSE, quiet = TRUE)
  never_update <- c("build.R", "README.rm", protect)
  always_update <- c("docs/data/datapackage.json", include)
  if (!dir.exists(parent)) {
    parent <- regmatches(
      parent,
      regexec("^(?:.*github\\.com/)?([^/]+/[^/@]+)", parent)
    )[[1]][2]
    repo <- tryCatch(
      jsonlite::read_json(
        paste0("https://api.github.com/repos/", parent, "/contents")
      ),
      error = function(e) e$message
    )
    if (is.character(repo))
      cli_abort(
        "treated {.arg parent} as a GitHub repository, but failed to retrieve it: {repo}"
      )
    if (missing(update)) update <- FALSE
    repo <- c(
      repo,
      tryCatch(
        jsonlite::read_json(
          paste0("https://api.github.com/repos/", parent, "/contents/docs")
        ),
        error = function(e) NULL
      ),
      tryCatch(
        jsonlite::read_json(
          paste0("https://api.github.com/repos/", parent, "/contents/docs/data")
        ),
        error = function(e) NULL
      )
    )
    for (f in repo) {
      if (f$path %in% files[!files %in% never_update]) {
        dest <- paste0(dir, "/", f$path)
        if (
          f$path %in% always_update || overwrite || update || filled[[f$path]]
        ) {
          unlink(dest)
          tryCatch(
            download.file(f$download_url, dest, quiet = TRUE),
            error = function(e) NULL
          )
          copied[[f$path]] <- file.exists(dest)
        }
      }
    }
  } else {
    for (f in files[!files %in% never_update]) {
      pf <- paste0(parent, "/", f)
      dest <- paste0(dir, "/", f)
      if (
        file.exists(pf) &&
          (f %in%
            always_update ||
            overwrite ||
            filled[[f]] ||
            (update && file.mtime(pf) > file.mtime(dest)))
      ) {
        unlink(dest)
        file.copy(pf, dest)
        copied[[f]] <- file.exists(dest)
      }
    }
  }
  if (!quiet) {
    if (any(copied)) {
      cli_bullets(c(
        v = "copied from {.path {parent}}:",
        "*" = paste0("{.path ", names(which(copied)), "}")
      ))
    }
    if (any(filled & !copied)) {
      cli_bullets(c(
        v = "created from template:",
        "*" = paste0("{.path ", names(which(filled & !copied)), "}")
      ))
    }
    if (!any(filled | copied)) {
      cli_alert_success("no site files were replaced")
    }
  }
  invisible(dir)
}
