#' @rdname download_dataverse_data
#' @return \code{download_dataverse_info}: A list with the dataset's metadata.
#' @export

download_dataverse_info <- function(
  id,
  server = NULL,
  key = NULL,
  refresh = FALSE,
  branch = NULL,
  version = ":latest",
  verbose = FALSE
) {
  if (missing(id)) cli_abort("an id must be specified")
  if (
    !grepl("doi", tolower(id), fixed = TRUE) &&
      (grepl("github", id, fixed = TRUE) || grepl("^[^/]+/[^/]+$", id))
  ) {
    if (is.null(branch) && grepl("@|/tree/", id)) {
      branch <- regmatches(id, regexec("(?:@|tree/)([^/]+)", id))[[1]][2]
      if (is.na(branch)) branch <- NULL
    }
    id <- regmatches(id, regexec("^(?:.*github\\.com/)?([^/]+/[^/@]+)", id))[[
      1
    ]][2]
    repo <- tryCatch(
      jsonlite::read_json(
        paste0("https://api.github.com/repos/", id)
      ),
      error = function(e) NULL
    )
    if (!is.null(repo$default_branch)) {
      if (verbose) cli_alert_info("getting ID from Github repository {id}")
      dataset_doi <- NULL
      tryCatch(
        load(file(paste0(
          "https://raw.githubusercontent.com/",
          id,
          "/",
          if (is.null(branch)) repo$default_branch else branch,
          "/R/sysdata.rda"
        ))),
        error = function(e) NULL
      )
      if (!is.null(dataset_doi)) {
        id <- dataset_doi[[1]]
      } else {
        cli_abort(paste0(
          "{.arg id} points to a Github repository that does not have an appropriate",
          "{.file /R/sysdata.rda} file"
        ))
      }
    }
  }
  id <- sub("^(http|doi)[^\\d]*", "", id, perl = TRUE)
  temp <- paste0(tempdir(), "/", gsub("\\W", "", id), ".json")
  if (refresh) unlink(temp)
  if (!file.exists(temp)) {
    if (is.null(server)) {
      server <- if (Sys.which("curl") != "") {
        if (verbose) cli_alert_info("getting server from DOI ({id}) redirect")
        tryCatch(
          {
            url <- gsub(
              "<[^>]*>",
              "",
              system2("curl", paste0("https://doi.org/", id), stdout = TRUE)[5]
            )
            if (grepl("^http", url))
              gsub("^https?://|/citation.*$", "", url) else NA
          },
          error = function(e) {
            if (verbose)
              cli_alert_info("failed to get server from DOI ({id}) redirect")
            NA
          }
        )
      } else {
        NA
      }
      if (is.na(server)) {
        if (verbose) cli_alert_info("looking for server in fall-backs")
        server <- Sys.getenv("DATAVERSE_SERVER")
        if (server == "") {
          server <- getOption("dataverse.server")
          if (is.null(server)) server <- "dataverse.lib.virginia.edu"
        }
      }
    }
    if (is.null(key)) {
      if (verbose) cli_alert_info("looking for API key in fall-backs")
      key <- Sys.getenv("DATAVERSE_KEY", getOption("dataverse.key", ""))
    }
    if (!grepl("://", server, fixed = TRUE))
      server <- paste0("https://", server)
    server <- sub("/api/.*$", "/", gsub("//+$", "/", paste0(server, "/")))
  }
  res <- tryCatch(
    {
      if (!file.exists(temp)) {
        if (verbose)
          cli_alert_info("downloading dataset metadata for {id} from {server}")
        if (is.character(key) && key != "") {
          if (verbose) cli_alert_info("trying with key")
          download.file(
            paste0(
              server,
              "api/datasets/:persistentId/versions/",
              version,
              "?persistentId=doi:",
              id
            ),
            temp,
            quiet = TRUE,
            headers = c("X-Dataverse-key" = key)
          )
          if (file.exists(temp)) {
            res <- jsonlite::read_json(temp)
            if (is.null(res$data)) {
              unlink(temp)
              stop(res$message)
            }
            res <- res$data
          } else {
            stop("download failed")
          }
        } else {
          if (verbose) cli_alert_info("trying without key")
          res <- jsonlite::read_json(
            paste0(
              server,
              "api/datasets/:persistentId/versions/",
              version,
              "?persistentId=doi:",
              id
            )
          )$data
        }
        res$server <- server
        jsonlite::write_json(res, temp, auto_unbox = TRUE)
        res
      } else {
        if (verbose) cli_alert_info("reading in existing metadata for {id}")
        jsonlite::read_json(temp)
      }
    },
    error = function(e) e$message
  )
  if (is.character(res)) {
    if (file.exists(temp)) {
      cli_abort(cli_bullets(c(
        x = "downloaded the metadata, but failed to read it in: {res}",
        i = paste0("check {.file ", temp, "}")
      )))
    } else {
      cli_abort(cli_bullets(c(
        x = "failed to retrive info",
        i = paste0(
          "tried for this dataset: {.url ",
          server,
          "dataset.xhtml?persistentId=doi:",
          id,
          "}"
        ),
        if (length(res)) c("!" = paste("got this error:", res))
      )))
    }
  }
  res
}
